from pydantic import BaseModel
from typing import Optional


class Sala(BaseModel):
    id: Optional[int] = None
    nome: str
    capacidade: int
    tipo: str

    model_config = {"from_attributes": True}
