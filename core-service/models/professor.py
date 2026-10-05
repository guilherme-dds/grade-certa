from pydantic import BaseModel
from typing import Optional

class Professor(BaseModel):
    id: Optional[int] = None
    nome: str
    email: str
