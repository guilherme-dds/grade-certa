import os
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session, joinedload

from database.models import TurmaDB, ProfessorDB, DisciplinaDB, DisponibilidadeDB, GradeDB, AulaDB, SalaDB
from models.jornada import Jornada
from services.grid_solver import (
    Almoco,
    Intervalo,
    ItemInput,
    ProfessorInput,
    SalaInput,
    TurmaInput,
    inferir_area,
    inferir_aula_dobrada,
    inferir_tipo_sala,
    normalizar,
    resolver_grade,
)
from services.jornada import jornada_padrao
from services.vinculo_professores import professores_do_item, vincular_por_id

# Tempo padrão do solver; a tela pode pedir outro (até TEMPO_MAXIMO_SEG)
TEMPO_LIMITE_SEG = float(os.getenv("GRADE_SOLVER_TIMEOUT", "120"))
TEMPO_MAXIMO_SEG = 900


class GridGeneratorService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _tipo_sala(disc, nome_disc, tipos_cadastrados):
        if disc and disc.tipo_sala:
            return disc.tipo_sala
        # Inferido só se a sala existir (ex.: quadra cadastrada), para não gerar avisos à toa
        inferido = inferir_tipo_sala(nome_disc)
        return inferido if inferido and normalizar(inferido) in tipos_cadastrados else None

    def generate(
        self,
        nome_grade: str = "Grade Gerada Automática",
        ano_semestre: str = "",
        tempo_limite_seg: Optional[float] = None,
        grade: Optional[GradeDB] = None,
    ) -> Dict[str, Any]:
        """
        Carrega os cadastros, executa o CP-SAT (services/grid_solver.py) e grava o resultado
        em `grade` (criada com status "gerando" pela rota) ou numa grade nova. Sucesso ou
        falha ficam registrados no histórico: status "sucesso", "inviavel", "tempo_esgotado"...
        Regras aplicadas: matriz curricular, horários por nível de ensino, sem choque de
        turma/professor/sala, indisponibilidade de professores e salas, uma aula dobrada por
        disciplina (Inglês individual), sem janelas, primeira/última aula do turno com
        professores diferentes, almoço, limite de aulas e de horas por dia (padrão da escola ou
        personalizados por professor) e 4 horários de planejamento, de preferência
        compartilhados com colegas da mesma área.
        """
        disciplinas = {normalizar(d.nome): d for d in self.db.query(DisciplinaDB).all()}
        # Todos os cadastrados: um professor inativo que continua na matriz mantém as restrições
        prof_by_id = {p.id: p for p in self.db.query(ProfessorDB).all()}
        id_por_nome = {normalizar(p.nome): p.id for p in prof_by_id.values() if p.nome}

        indisp_prof: Dict[int, List[Intervalo]] = {}
        pref_prof: Dict[int, List[Intervalo]] = {}
        for disp in self.db.query(DisponibilidadeDB).all():
            destino = pref_prof if disp.tipo == "preferencial" else indisp_prof
            destino.setdefault(disp.professor_id, []).append(
                Intervalo(
                    dia=disp.dia_semana,
                    horario=f"{disp.horario_inicio} - {disp.horario_fim}",
                    nivel=disp.nivel_ensino,
                )
            )

        salas = {
            s.id: SalaInput(
                id=s.id,
                nome=s.nome,
                tipo=s.tipo,
                indisponivel=[
                    Intervalo(dia=i.dia_semana, horario=f"{i.horario_inicio} - {i.horario_fim}")
                    for i in s.indisponibilidades
                ],
            )
            for s in self.db.query(SalaDB).options(joinedload(SalaDB.indisponibilidades)).all()
        }

        tipos_cadastrados = {normalizar(s.tipo) for s in salas.values()}

        padrao = jornada_padrao(self.db)
        professores: Dict[str, ProfessorInput] = {}
        avisos_carga: List[str] = []
        turmas: List[TurmaInput] = []

        def professor_input(chave: str, nome: str, prof: Optional[ProfessorDB]) -> ProfessorInput:
            jornada = Jornada(**prof.jornada) if prof and prof.jornada else padrao
            return ProfessorInput(
                chave=chave,
                nome=nome,
                id=prof.id if prof else None,
                carga_maxima=prof.carga_maxima_aulas if prof else None,
                indisponivel=indisp_prof.get(prof.id, []) if prof else [],
                preferencial=pref_prof.get(prof.id, []) if prof else [],
                almoco=(
                    Almoco(jornada.almoco_inicio, jornada.almoco_fim, jornada.almoco_minutos)
                    if jornada.almoco_minutos
                    else None
                ),
                max_aulas_dia=jornada.max_aulas_dia,
                max_minutos_dia=round(jornada.max_horas_dia * 60) if jornada.max_horas_dia else None,
            )

        for t in self.db.query(TurmaDB).all():
            itens: List[ItemInput] = []
            # Nomes de professores cadastrados viram id (matrizes salvas antes do vínculo por id)
            for item in vincular_por_id(t.matriz_curricular, id_por_nome):
                if int(item.get("aulas_semanais", 0) or 0) <= 0:
                    continue
                nome_disc = item.get("disciplina") or "Sem nome"
                disc = disciplinas.get(normalizar(nome_disc))
                ids, sem_cadastro = professores_do_item(item)
                chaves: List[str] = []
                for prof_id in ids:
                    prof = prof_by_id.get(prof_id)
                    if prof is None:
                        avisos_carga.append(
                            f"Um professor excluído do cadastro estava em '{nome_disc}' da turma '{t.nome}'; "
                            "a aula foi distribuída sem ele."
                        )
                        continue
                    chave = f"id:{prof.id}"
                    chaves.append(chave)
                    if chave not in professores:
                        professores[chave] = professor_input(chave, prof.nome, prof)
                        if not prof.ativo:
                            avisos_carga.append(
                                f"O professor '{prof.nome}' está inativo, mas continua na matriz curricular "
                                f"(ex.: '{nome_disc}' da turma '{t.nome}')."
                            )
                for prof_nome in sem_cadastro:
                    chave = normalizar(prof_nome)
                    if chave in chaves:
                        continue
                    chaves.append(chave)
                    if chave not in professores:
                        avisos_carga.append(
                            f"Professor '{prof_nome}' da turma '{t.nome}' não está cadastrado; "
                            "carga máxima, indisponibilidade e jornada não foram verificadas."
                        )
                        professores[chave] = professor_input(chave, prof_nome, None)
                itens.append(
                    ItemInput(
                        disciplina=nome_disc,
                        aulas_semanais=int(item["aulas_semanais"]),
                        professores=chaves,
                        horarios_fixos=[
                            (h["dia_semana"], h.get("horario") or None) for h in item.get("horarios_fixos") or []
                        ],
                        area=(disc.area if disc and disc.area else inferir_area(nome_disc)),
                        aula_dobrada=(
                            disc.aula_dobrada
                            if disc and disc.aula_dobrada is not None
                            else inferir_aula_dobrada(nome_disc)
                        ),
                        tipo_sala=self._tipo_sala(disc, nome_disc, tipos_cadastrados),
                    )
                )
            turmas.append(
                TurmaInput(
                    id=t.id,
                    nome=t.nome,
                    turno=t.turno,
                    nivel_ensino=t.nivel_ensino,
                    sala_id=t.sala_id,
                    itens=itens,
                    tardes=t.tardes or [],
                )
            )

        if grade is None:
            grade = GradeDB(nome=nome_grade, ano_semestre=ano_semestre or None, status="gerando", total_aulas=0)
            self.db.add(grade)
            self.db.flush()

        tempo_limite = tempo_limite_seg or TEMPO_LIMITE_SEG
        resultado = resolver_grade(turmas, professores, salas, tempo_limite_seg=tempo_limite)
        avisos = avisos_carga + resultado.avisos
        detalhes = {
            "mensagem": resultado.mensagem,
            "solver_status": resultado.solver_status,
            "tempo_resolucao_seg": resultado.tempo_seg,
            "tempo_limite_seg": tempo_limite,
            "turmas_processadas": len([t for t in turmas if t.itens]),
            "avisos": avisos,
        }

        if not resultado.sucesso:
            grade.status = resultado.status
            grade.detalhes = {**detalhes, "regras_em_conflito": resultado.regras_em_conflito}
            self.db.commit()
            return {
                "sucesso": False,
                "status": resultado.status,
                "mensagem": resultado.mensagem,
                "regras_em_conflito": resultado.regras_em_conflito,
                "avisos": avisos,
                "total_aulas": 0,
                "grade_id": grade.id,
            }

        planejamentos = [
            {
                "professor": professores[p.professor_chave].nome,
                "professor_id": professores[p.professor_chave].id,
                "dia_semana": p.dia,
                "horario": p.horario,
                "compartilhado": p.compartilhado,
            }
            for p in resultado.planejamentos
        ]

        grade_db = grade
        grade_db.status = "sucesso"
        grade_db.total_aulas = len(resultado.aulas)
        janelas = [
            {
                "professor": professores[chave].nome,
                "professor_id": professores[chave].id,
                "dia_semana": dia,
                "horario": horario,
            }
            for chave, dia, horario in resultado.janelas
        ]
        grade_db.detalhes = {**detalhes, "planejamentos": planejamentos, "janelas": janelas}

        self.db.add_all(
            [
                AulaDB(
                    grade_id=grade_db.id,
                    turma_id=a.turma_id,
                    turma_nome=a.turma_nome,
                    disciplina_nome=a.disciplina,
                    professor_id=professores[a.professor_chaves[0]].id if a.professor_chaves else None,
                    professor_nome=professores[a.professor_chaves[0]].nome if a.professor_chaves else None,
                    professores=[
                        {"id": professores[c].id, "nome": professores[c].nome} for c in a.professor_chaves
                    ],
                    sala_nome=salas[a.sala_id].nome if a.sala_id is not None else None,
                    dia_semana=a.dia,
                    horario=a.horario,
                    ordem=a.ordem,
                )
                for a in resultado.aulas
            ]
        )
        self.db.commit()
        self.db.refresh(grade_db)

        compartilhados = sum(1 for p in planejamentos if p["compartilhado"])
        return {
            "sucesso": True,
            "status": "sucesso",
            "mensagem": resultado.mensagem,
            "grade_id": grade_db.id,
            "total_aulas": len(resultado.aulas),
            "tempo_seg": resultado.tempo_seg,
            "planejamentos_compartilhados": f"{compartilhados}/{len(planejamentos)}",
            "avisos": avisos,
        }
