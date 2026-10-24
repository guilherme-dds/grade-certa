from pydantic import BaseModel
from typing import Literal, Optional

class Disponibilidade(BaseModel):
    id: Optional[int] = None
    professor_id: int
    dia_semana: str
    horario_inicio: str
    horario_fim: str
    tipo: Literal["indisponivel", "preferencial"] = "indisponivel"
    nivel_ensino: Optional[str] = None

    model_config = {"from_attributes": True}


class DisponibilidadeItem(BaseModel):
    """Um horário marcado na grade de disponibilidade de um professor."""
    dia_semana: str
    horario_inicio: str
    horario_fim: str
    tipo: Literal["indisponivel", "preferencial"] = "indisponivel"
    nivel_ensino: Optional[str] = None
