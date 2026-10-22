import os
from typing import Dict, Any, List

from sqlalchemy.orm import Session, joinedload

from database.models import TurmaDB, ProfessorDB, DisciplinaDB, DisponibilidadeDB, GradeDB, AulaDB, SalaDB
from services.grid_solver import (
    Intervalo,
    ItemInput,
    ProfessorInput,
    SalaInput,
    TurmaInput,
    inferir_area,
    inferir_aula_dobrada,
    normalizar,
    resolver_grade,
)

TEMPO_LIMITE_SEG = float(os.getenv("GRADE_SOLVER_TIMEOUT", "45"))


class GridGeneratorService:
    def __init__(self, db: Session):
        self.db = db

    def generate(self, nome_grade: str = "Grade Gerada Automática") -> Dict[str, Any]:
        """
        Carrega os cadastros, executa o CP-SAT (services/grid_solver.py) e grava a grade.
        Regras aplicadas: matriz curricular, horários por nível de ensino, sem choque de
        turma/professor/sala, indisponibilidade de professores e salas, uma aula dobrada por
        disciplina (Inglês individual), sem janelas, primeira/última aula do turno com
        professores diferentes e 4 horários de planejamento, de preferência compartilhados
        com colegas da mesma área.
        """
        disciplinas = {normalizar(d.nome): d for d in self.db.query(DisciplinaDB).all()}
        professores_db = self.db.query(ProfessorDB).filter(ProfessorDB.ativo == True).all()
        prof_by_key = {normalizar(p.nome): p for p in professores_db if p.nome}

        indisp_prof: Dict[int, List[Intervalo]] = {}
        for disp in self.db.query(DisponibilidadeDB).all():
            indisp_prof.setdefault(disp.professor_id, []).append(
                Intervalo(dia=disp.dia_semana, horario=f"{disp.horario_inicio} - {disp.horario_fim}")
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

        professores: Dict[str, ProfessorInput] = {}
        avisos_carga: List[str] = []
        turmas: List[TurmaInput] = []
        for t in self.db.query(TurmaDB).all():
            itens: List[ItemInput] = []
            for item in t.matriz_curricular or []:
                if not isinstance(item, dict) or int(item.get("aulas_semanais", 0) or 0) <= 0:
                    continue
                nome_disc = item.get("disciplina") or "Sem nome"
                disc = disciplinas.get(normalizar(nome_disc))
                prof_nome = (item.get("professor") or "").strip()
                chave = normalizar(prof_nome) or None
                if chave and chave not in professores:
                    prof = prof_by_key.get(chave)
                    if prof is None:
                        avisos_carga.append(
                            f"Professor '{prof_nome}' da turma '{t.nome}' não está cadastrado (ou está inativo); "
                            "carga máxima e indisponibilidade não foram verificadas."
                        )
                    professores[chave] = ProfessorInput(
                        chave=chave,
                        nome=prof.nome if prof else prof_nome,
                        id=prof.id if prof else None,
                        carga_maxima=prof.carga_maxima_aulas if prof else None,
                        indisponivel=indisp_prof.get(prof.id, []) if prof else [],
                    )
                itens.append(
                    ItemInput(
                        disciplina=nome_disc,
                        aulas_semanais=int(item["aulas_semanais"]),
                        professor=chave,
                        area=(disc.area if disc and disc.area else inferir_area(nome_disc)),
                        aula_dobrada=(
                            disc.aula_dobrada
                            if disc and disc.aula_dobrada is not None
                            else inferir_aula_dobrada(nome_disc)
                        ),
                        tipo_sala=disc.tipo_sala if disc else None,
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
                )
            )

        resultado = resolver_grade(turmas, professores, salas, tempo_limite_seg=TEMPO_LIMITE_SEG)
        avisos = avisos_carga + resultado.avisos

        if not resultado.sucesso:
            return {
                "sucesso": False,
                "status": resultado.status,
                "mensagem": resultado.mensagem,
                "regras_em_conflito": resultado.regras_em_conflito,
                "avisos": avisos,
                "total_aulas": 0,
                "grade_id": None,
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

        grade_db = GradeDB(
            nome=nome_grade,
            status="sucesso",
            ano_semestre="2026.2",
            total_aulas=len(resultado.aulas),
            detalhes={
                "solver_status": resultado.solver_status,
                "tempo_resolucao_seg": resultado.tempo_seg,
                "turmas_processadas": len([t for t in turmas if t.itens]),
                "planejamentos": planejamentos,
                "avisos": avisos,
            },
        )
        self.db.add(grade_db)
        self.db.flush()

        self.db.add_all(
            [
                AulaDB(
                    grade_id=grade_db.id,
                    turma_id=a.turma_id,
                    turma_nome=a.turma_nome,
                    disciplina_nome=a.disciplina,
                    professor_id=professores[a.professor_chave].id if a.professor_chave else None,
                    professor_nome=professores[a.professor_chave].nome if a.professor_chave else None,
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
