from pydantic import BaseModel, model_validator
from typing import Optional, List

class ItemMatriz(BaseModel):
    disciplina: str
    aulas_semanais: int = 4
    # Professores que dão a aula juntos (ou em rodízio); todos ficam reservados no horário
    professores: List[str] = []
    # Formato antigo (um professor só); mantido igual ao primeiro de `professores`
    professor: Optional[str] = None

    @model_validator(mode="after")
    def _sincroniza_professores(self):
        nomes = [p.strip() for p in (self.professores or [self.professor or ""]) if p and p.strip()]
        self.professores = list(dict.fromkeys(nomes))
        self.professor = self.professores[0] if self.professores else None
        return self

class Turma(BaseModel):
    id: Optional[int] = None
    nome: str
    turno: str
    nivel_ensino: Optional[str] = "Anos Finais"
    matriz_curricular: Optional[List[ItemMatriz]] = []
    sala_id: Optional[int] = None
