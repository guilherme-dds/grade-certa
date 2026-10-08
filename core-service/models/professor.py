from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class NivelEnsino(str, Enum):
    ANOS_INICIAIS = "Anos Iniciais"
    ANOS_FINAIS = "Anos Finais"
    ENSINO_MEDIO = "Ensino Médio"

class Professor(BaseModel):
    id: Optional[int] = None
    nome: str
    email: str
    niveis_ensino: List[str] = Field(default_factory=list)
    disciplinas: List[int] = Field(default_factory=list)
    carga_maxima_aulas: int = 20
    ativo: bool = True
