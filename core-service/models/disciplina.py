from pydantic import BaseModel
from typing import Optional

class Disciplina(BaseModel):
    id: Optional[int] = None
    nome: str
    quantidade_aulas: int
