from pydantic import BaseModel
from typing import Optional, List

class ItemMatriz(BaseModel):
    disciplina: str
    aulas_semanais: int = 4
    professor: Optional[str] = None

class Turma(BaseModel):
    id: Optional[int] = None
    nome: str
    turno: str
    matriz_curricular: Optional[List[ItemMatriz]] = []

