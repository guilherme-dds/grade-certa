"""
Detecta conflitos em uma grade já gravada (normalmente causados por edição manual de aulas)
e sugere um horário livre para a aula que conflita.
"""
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from database.models import AulaDB, DisponibilidadeDB, GradeDB, SalaDB, TurmaDB
from services.grid_solver import Intervalo, normalizar
from services.time_slots import DIAS_SEMANA, get_slots_for_turma, infer_nivel_ensino, slots_overlap


def horarios_da_turma(turma: Optional[TurmaDB]) -> List[str]:
    if turma is None:
        return []
    return [s["horario"] for s in get_slots_for_turma(turma.turno, turma.nivel_ensino, turma.nome)]


class DetectorConflitos:
    def __init__(self, db: Session, grade: GradeDB):
        self.aulas: List[AulaDB] = sorted(grade.aulas, key=lambda a: a.id)
        self.turmas = {t.id: t for t in db.query(TurmaDB).all()}
        self.indisp_prof: Dict[int, List[Intervalo]] = {}
        for d in db.query(DisponibilidadeDB).filter(DisponibilidadeDB.tipo == "indisponivel").all():
            self.indisp_prof.setdefault(d.professor_id, []).append(
                Intervalo(d.dia_semana, f"{d.horario_inicio} - {d.horario_fim}", d.nivel_ensino)
            )
        self.indisp_sala: Dict[str, List[Intervalo]] = {
            s.nome: [Intervalo(i.dia_semana, f"{i.horario_inicio} - {i.horario_fim}") for i in s.indisponibilidades]
            for s in db.query(SalaDB).options(joinedload(SalaDB.indisponibilidades)).all()
        }

    def _nivel(self, aula: AulaDB) -> Optional[str]:
        turma = self.turmas.get(aula.turma_id)
        return infer_nivel_ensino(turma.nome, turma.nivel_ensino) if turma else None

    @staticmethod
    def _mesmo_professor(a: AulaDB, b: AulaDB) -> bool:
        if a.professor_id is not None and b.professor_id is not None:
            return a.professor_id == b.professor_id
        return bool(a.professor_nome) and normalizar(a.professor_nome) == normalizar(b.professor_nome)

    def _professor_indisponivel(self, aula: AulaDB, dia: str, horario: str) -> bool:
        return any(i.aplica(dia, horario, self._nivel(aula)) for i in self.indisp_prof.get(aula.professor_id, []))

    def _sala_indisponivel(self, aula: AulaDB, dia: str, horario: str) -> bool:
        return any(i.aplica(dia, horario) for i in self.indisp_sala.get(aula.sala_nome or "", []))

    def _horario_livre(self, aula: AulaDB, dia: str, horario: str) -> bool:
        for outra in self.aulas:
            if outra.id == aula.id or outra.dia_semana != dia or not slots_overlap(outra.horario, horario):
                continue
            if outra.turma_id == aula.turma_id or self._mesmo_professor(outra, aula):
                return False
            if aula.sala_nome and outra.sala_nome == aula.sala_nome:
                return False
        return not self._professor_indisponivel(aula, dia, horario) and not self._sala_indisponivel(aula, dia, horario)

    def _sugestao(self, aula: AulaDB) -> Tuple[Optional[str], Optional[Dict[str, str]]]:
        for dia in DIAS_SEMANA:
            for horario in horarios_da_turma(self.turmas.get(aula.turma_id)):
                if (dia, horario) == (aula.dia_semana, aula.horario):
                    continue
                if self._horario_livre(aula, dia, horario):
                    texto = f"Mover {aula.disciplina_nome} ({aula.turma_nome}) para {dia}, {horario}."
                    return texto, {"dia_semana": dia, "horario": horario}
        return None, None

    def _conflito(self, tipo: str, gravidade: str, descricao: str, aula: AulaDB, outra: Optional[AulaDB] = None):
        sugestao, correcao = self._sugestao(aula)
        return {
            "id": f"{tipo}-{aula.id}-{outra.id if outra else 0}",
            "gravidade": gravidade,
            "tipo": tipo,
            "descricao": descricao,
            "aula_id": aula.id,
            "turma_nome": aula.turma_nome,
            "sugestao": sugestao,
            "correcao": correcao,
        }

    def detectar(self) -> List[Dict[str, Any]]:
        conflitos = []
        for i, a in enumerate(self.aulas):
            for b in self.aulas[i + 1:]:
                if a.dia_semana != b.dia_semana or not slots_overlap(a.horario, b.horario):
                    continue
                quando = f"{b.dia_semana}, {b.horario}"
                if a.turma_id == b.turma_id:
                    conflitos.append(self._conflito(
                        "Choque de turma", "alto",
                        f"{a.turma_nome} tem {a.disciplina_nome} e {b.disciplina_nome} ao mesmo tempo ({quando}).", b, a,
                    ))
                if a.professor_nome and self._mesmo_professor(a, b):
                    conflitos.append(self._conflito(
                        "Professor duplicado", "alto",
                        f"{b.professor_nome} está em {a.turma_nome} e {b.turma_nome} ao mesmo tempo ({quando}).", b, a,
                    ))
                if a.sala_nome and a.sala_nome == b.sala_nome:
                    conflitos.append(self._conflito(
                        "Sala ocupada", "medio",
                        f"{b.sala_nome} reservada para {a.turma_nome} e {b.turma_nome} ao mesmo tempo ({quando}).", b, a,
                    ))

        for a in self.aulas:
            quando = f"{a.dia_semana}, {a.horario}"
            if a.professor_id is not None and self._professor_indisponivel(a, a.dia_semana, a.horario):
                conflitos.append(self._conflito(
                    "Professor indisponível", "alto",
                    f"{a.professor_nome} marcou {quando} como indisponível ({a.disciplina_nome}, {a.turma_nome}).", a,
                ))
            if a.sala_nome and self._sala_indisponivel(a, a.dia_semana, a.horario):
                conflitos.append(self._conflito(
                    "Sala indisponível", "medio",
                    f"{a.sala_nome} está bloqueada em {quando} ({a.disciplina_nome}, {a.turma_nome}).", a,
                ))
        return conflitos
