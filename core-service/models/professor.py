from pydantic import BaseModel, Field
from typing import List, Optional

class Professor(BaseModel):
    id: Optional[int] = None
    nome: str
    email: str
    disciplinas: List[int] = Field(default_factory=list)
    carga_maxima_aulas: int = 20
    ativo: bool = True
