from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from enum import Enum

from models.jornada import Jornada

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
    disponibilidade_atualizada_em: Optional[datetime] = None
    # Nulo = segue a jornada padrão da escola
    jornada: Optional[Jornada] = None
