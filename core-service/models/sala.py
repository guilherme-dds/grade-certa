from pydantic import BaseModel
from typing import Optional, List


class IndisponibilidadeSala(BaseModel):
    id: Optional[int] = None
    dia_semana: str
    horario_inicio: str
    horario_fim: str
    motivo: Optional[str] = None

    model_config = {"from_attributes": True}


class Sala(BaseModel):
    id: Optional[int] = None
    nome: str
    capacidade: int = 40
    tipo: str = "Sala comum"
    indisponibilidades: List[IndisponibilidadeSala] = []

    model_config = {"from_attributes": True}
