from pydantic import BaseModel
from typing import Optional

class Disponibilidade(BaseModel):
    id: Optional[int] = None
    professor_id: int
    dia_semana: str
    horario_inicio: str
    horario_fim: str
