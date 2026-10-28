from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List

from services.time_slots import DIAS_SEMANA

class HorarioFixo(BaseModel):
    dia_semana: str
    # "HH:MM - HH:MM", um dos horários de aula da turma; nulo = qualquer horário do dia
    horario: Optional[str] = None


class ItemMatriz(BaseModel):
    disciplina: str
    aulas_semanais: int = 4
    # Professores que dão a aula juntos (ou em rodízio); todos ficam reservados no horário
    professores: List[str] = []
    # Formato antigo (um professor só); mantido igual ao primeiro de `professores`
    professor: Optional[str] = None
    # Dias e horários definidos pela escola; as demais aulas o gerador distribui
    horarios_fixos: List[HorarioFixo] = []
    # Aula extra (ex.: laboratório): ocupa horário na grade, mas não entra no total da matriz
    extra: bool = False

    @model_validator(mode="after")
    def _sincroniza_professores(self):
        nomes = [p.strip() for p in (self.professores or [self.professor or ""]) if p and p.strip()]
        self.professores = list(dict.fromkeys(nomes))
        self.professor = self.professores[0] if self.professores else None
        exatos = {(h.dia_semana, h.horario) for h in self.horarios_fixos if h.horario}
        so_dia = [h for h in self.horarios_fixos if not h.horario]
        if len(exatos) + len(so_dia) > self.aulas_semanais:
            raise ValueError(f"'{self.disciplina}' tem mais dias/horários fixos que aulas semanais.")
        return self

class Turma(BaseModel):
    id: Optional[int] = None
    nome: str
    turno: str
    nivel_ensino: Optional[str] = "Anos Finais"
    matriz_curricular: Optional[List[ItemMatriz]] = []
    sala_id: Optional[int] = None
    # Turno "Manhã + tardes": dias com aula à tarde; vazio = o gerador escolhe quais tardes usar
    tardes: List[str] = []

    @field_validator("tardes", mode="before")
    @classmethod
    def _tardes_validas(cls, valor):
        dias = valor or []
        invalidos = [d for d in dias if d not in DIAS_SEMANA]
        if invalidos:
            raise ValueError(f"Dias inválidos: {', '.join(invalidos)}")
        return [d for d in DIAS_SEMANA if d in dias]
