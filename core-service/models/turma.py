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
    nivel_ensino: Optional[str] = "Anos Finais"
    matriz_curricular: Optional[List[ItemMatriz]] = []
    sala_id: Optional[int] = None
