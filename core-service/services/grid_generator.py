import math
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from database.models import TurmaDB, ProfessorDB, DisponibilidadeDB, GradeDB, AulaDB
from services.time_slots import DIAS_SEMANA, get_slots_for_turma, slots_overlap, infer_nivel_ensino


class GridGeneratorService:
    def __init__(self, db: Session):
        self.db = db

    def generate(self, nome_grade: str = "Grade Gerada Automática") -> Dict[str, Any]:
        """
        Executa o resolvedor CP-SAT do Google OR-Tools para alocar as aulas
        respeitando:
        1. A matriz curricular de cada turma;
        2. Os horários específicos de cada nível de ensino (Médio, Anos Finais, Anos Iniciais);
        3. Sobreposição real de horários para professores que lecionam em níveis diferentes;
        4. Não choque de turma (no máx 1 aula por horário);
        5. Disponibilidade dos professores;
        6. Limites pedagógicos e aulas geminadas.
        """
        # 1. Carrega dados do banco
        turmas = self.db.query(TurmaDB).all()
        professores = self.db.query(ProfessorDB).filter(ProfessorDB.ativo == True).all()
        disponibilidades = self.db.query(DisponibilidadeDB).all()

        # Indexadores úteis
        prof_by_name = {p.nome.strip().lower(): p for p in professores if p.nome}
        prof_by_id = {p.id: p for p in professores}

        # Filtra turmas que possuem matriz curricular válida
        turmas_validas: List[Tuple[TurmaDB, List[Dict[str, Any]]]] = []
        for t in turmas:
            matriz = t.matriz_curricular or []
            itens_com_aulas = [
                item for item in matriz
                if isinstance(item, dict) and item.get("aulas_semanais", 0) > 0
            ]
            if itens_com_aulas:
                turmas_validas.append((t, itens_com_aulas))

        if not turmas_validas:
            return {
                "sucesso": False,
                "status": "sem_dados",
                "mensagem": "Nenhuma turma possui matriz curricular com aulas semanais cadastradas.",
                "total_aulas": 0,
                "grade_id": None,
            }

        # 2. Inicializa o modelo CP-SAT
        model = cp_model.CpModel()

        # Dicionário de variáveis de decisão:
        # chave: (turma_id, item_idx, dia, slot_ordem) -> BoolVar
        x: Dict[Tuple[int, int, str, int], cp_model.IntVar] = {}

        # Mapeamento auxiliar:
        # turma_slots: turma_id -> lista de slots do nível e turno da turma
        turma_slots: Dict[int, List[Dict[str, Any]]] = {}

        # prof_allocations: prof_key -> dia -> list of (var, slot_dict)
        prof_allocations: Dict[str, Dict[str, List[Tuple[cp_model.IntVar, Dict[str, Any]]]]] = {}

        total_aulas_esperadas = 0

        # Pré-validação e criação das variáveis
        for t, itens in turmas_validas:
            nivel = getattr(t, "nivel_ensino", None)
            slots = get_slots_for_turma(turno=t.turno, nivel_ensino=nivel, turma_nome=t.nome)
            turma_slots[t.id] = slots

            slots_por_semana = len(DIAS_SEMANA) * len(slots)
            aulas_totais_turma = sum(item.get("aulas_semanais", 0) for item in itens)

            if aulas_totais_turma > slots_por_semana:
                return {
                    "sucesso": False,
                    "status": "inviavel",
                    "mensagem": (
                        f"Inviável: a turma '{t.nome}' necessita de {aulas_totais_turma} aulas semanais, "
                        f"mas o nível '{infer_nivel_ensino(t.nome, nivel)}' no turno '{t.turno}' disponibiliza "
                        f"apenas {slots_por_semana} horários na semana ({len(slots)} por dia)."
                    ),
                    "total_aulas": 0,
                    "grade_id": None,
                }

            total_aulas_esperadas += aulas_totais_turma

            for idx, item in enumerate(itens):
                prof_nome = (item.get("professor") or "").strip()
                prof_key = prof_nome.lower() if prof_nome else None

                for dia in DIAS_SEMANA:
                    for slot in slots:
                        ordem = slot["ordem"]
                        var = model.NewBoolVar(f"x_t{t.id}_i{idx}_{dia}_s{ordem}")
                        x[(t.id, idx, dia, ordem)] = var

                        # Registra para alocação do professor
                        if prof_key:
                            if prof_key not in prof_allocations:
                                prof_allocations[prof_key] = {}
                            if dia not in prof_allocations[prof_key]:
                                prof_allocations[prof_key][dia] = []
                            prof_allocations[prof_key][dia].append((var, slot))

        # 3. Restrições Rígidas (Hard Constraints)

        # H1: Cumprir exatamente a quantidade de aulas semanais de cada disciplina
        for t, itens in turmas_validas:
            slots = turma_slots[t.id]
            for idx, item in enumerate(itens):
                qtd_aulas = int(item.get("aulas_semanais", 0))
                vars_disciplina = [
                    x[(t.id, idx, dia, slot["ordem"])]
                    for dia in DIAS_SEMANA
                    for slot in slots
                ]
                model.Add(sum(vars_disciplina) == qtd_aulas)

        # H2: No máximo 1 aula por horário para a mesma turma (Sem choque de turma)
        for t, itens in turmas_validas:
            slots = turma_slots[t.id]
            for dia in DIAS_SEMANA:
                for slot in slots:
                    ordem = slot["ordem"]
                    vars_no_slot = [
                        x[(t.id, idx, dia, ordem)]
                        for idx in range(len(itens))
                    ]
                    model.Add(sum(vars_no_slot) <= 1)

        # H3: Sem choque de professor por sobreposição real de tempo
        # Mesmo que uma turma seja do Ensino Médio (ex: 09:15 - 10:05) e outra dos Anos Finais (09:00 - 09:50),
        # se os intervalos de horário colidirem, o professor não pode ser alocado em ambos!
        for prof_key, dia_dict in prof_allocations.items():
            for dia, allocations in dia_dict.items():
                n = len(allocations)
                for i in range(n):
                    var_i, slot_i = allocations[i]
                    for j in range(i + 1, n):
                        var_j, slot_j = allocations[j]
                        if slots_overlap(slot_i["horario"], slot_j["horario"]):
                            model.Add(var_i + var_j <= 1)

        # H4: Respeito à indisponibilidade cadastrada do professor
        for disp in disponibilidades:
            prof = prof_by_id.get(disp.professor_id)
            if not prof:
                continue
            prof_key = prof.nome.strip().lower()
            if prof_key not in prof_allocations:
                continue
            disp_range = f"{disp.horario_inicio} - {disp.horario_fim}"
            for var, slot in prof_allocations[prof_key].get(disp.dia_semana, []):
                if slots_overlap(slot["horario"], disp_range):
                    model.Add(var == 0)

        # H5: Limite pedagógico de aulas da mesma matéria no mesmo dia (máx 2 por dia se viável)
        for t, itens in turmas_validas:
            slots = turma_slots[t.id]
            for idx, item in enumerate(itens):
                qtd_aulas = int(item.get("aulas_semanais", 0))
                max_diario = max(2, math.ceil(qtd_aulas / len(DIAS_SEMANA)))
                for dia in DIAS_SEMANA:
                    vars_do_dia = [
                        x[(t.id, idx, dia, slot["ordem"])]
                        for slot in slots
                    ]
                    model.Add(sum(vars_do_dia) <= max_diario)

        # 4. Função Objetivo / Soft Constraints (Otimização da Qualidade)
        # Incentiva que aulas duplas da mesma matéria no mesmo dia fiquem juntas (geminadas)
        consecutive_bonuses: List[cp_model.IntVar] = []
        for t, itens in turmas_validas:
            slots = turma_slots[t.id]
            for idx, _ in enumerate(itens):
                for dia in DIAS_SEMANA:
                    for s_idx in range(len(slots) - 1):
                        s1 = slots[s_idx]["ordem"]
                        s2 = slots[s_idx + 1]["ordem"]
                        v1 = x[(t.id, idx, dia, s1)]
                        v2 = x[(t.id, idx, dia, s2)]

                        # Variável booleana que vale 1 se v1 e v2 forem simultaneamente 1 (aulas geminadas consecutivas)
                        consec_var = model.NewBoolVar(f"consec_t{t.id}_i{idx}_{dia}_{s1}_{s2}")
                        model.AddBoolAnd([v1, v2]).OnlyEnforceIf(consec_var)
                        model.AddBoolOr([v1.Not(), v2.Not()]).OnlyEnforceIf(consec_var.Not())
                        consecutive_bonuses.append(consec_var)

        if consecutive_bonuses:
            model.Maximize(sum(consecutive_bonuses))

        # 5. Execução do Solver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 15.0
        solver.parameters.num_workers = 4

        status = solver.Solve(model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {
                "sucesso": False,
                "status": "inviavel",
                "mensagem": "Não foi possível encontrar uma grade sem conflitos para as turmas e professores com as restrições e horários de ensino atuais.",
                "total_aulas": 0,
                "grade_id": None,
            }

        # 6. Gravação da Grade Gerada no Banco de Dados
        grade_db = GradeDB(
            nome=nome_grade,
            status="sucesso",
            ano_semestre="2026.2",
            total_aulas=total_aulas_esperadas,
            detalhes={
                "solver_status": solver.StatusName(status),
                "tempo_resolucao_seg": round(solver.WallTime(), 3),
                "turmas_processadas": len(turmas_validas),
            },
        )
        self.db.add(grade_db)
        self.db.flush()

        aulas_db: List[AulaDB] = []
        for t, itens in turmas_validas:
            slots = turma_slots[t.id]
            slots_by_ordem = {s["ordem"]: s["horario"] for s in slots}

            for idx, item in enumerate(itens):
                disciplina_nome = item.get("disciplina", "Sem nome")
                prof_nome = item.get("professor")
                prof_id = None
                if prof_nome and prof_nome.strip().lower() in prof_by_name:
                    prof_id = prof_by_name[prof_nome.strip().lower()].id

                for dia in DIAS_SEMANA:
                    for slot in slots:
                        ordem = slot["ordem"]
                        if solver.Value(x[(t.id, idx, dia, ordem)]) == 1:
                            aula = AulaDB(
                                grade_id=grade_db.id,
                                turma_id=t.id,
                                turma_nome=t.nome,
                                disciplina_nome=disciplina_nome,
                                professor_id=prof_id,
                                professor_nome=prof_nome,
                                dia_semana=dia,
                                horario=slots_by_ordem[ordem],
                                ordem=ordem,
                            )
                            aulas_db.append(aula)

        self.db.add_all(aulas_db)
        self.db.commit()
        self.db.refresh(grade_db)

        return {
            "sucesso": True,
            "status": "sucesso",
            "mensagem": "Grade gerada com sucesso respeitando os horários de cada nível de ensino!",
            "grade_id": grade_db.id,
            "total_aulas": len(aulas_db),
            "tempo_seg": round(solver.WallTime(), 3),
        }
