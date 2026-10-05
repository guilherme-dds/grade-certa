from pydantic import BaseModel
from typing import Optional

class Turma(BaseModel):
    id: Optional[int] = None
    nome: str
    turno: str
