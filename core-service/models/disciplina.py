from pydantic import BaseModel
from typing import Optional

class Disciplina(BaseModel):
    id: Optional[int] = None
    nome: str
    quantidade_aulas: int
    area: Optional[str] = None
    tipo_sala: Optional[str] = None
    aula_dobrada: Optional[bool] = None
