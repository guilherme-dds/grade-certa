from pydantic import BaseModel
from typing import List, Optional

class Aula(BaseModel):
    disciplina_id: int
    professor_id: int
    turma_id: int
    dia_semana: str
    horario: str

class Grade(BaseModel):
    aulas: List[Aula]
