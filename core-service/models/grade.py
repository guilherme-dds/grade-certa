from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class Aula(BaseModel):
    id: Optional[int] = None
    turma_id: int
    turma_nome: str
    disciplina_nome: str
    disciplina_id: Optional[int] = None
    professor_id: Optional[int] = None
    professor_nome: Optional[str] = None
    sala_nome: Optional[str] = None
    dia_semana: str
    horario: str
    ordem: int = 1

    model_config = {"from_attributes": True}


class Grade(BaseModel):
    id: Optional[int] = None
    nome: str = "Grade Horária Automática"
    status: str = "sucesso"
    ano_semestre: Optional[str] = "2026.2"
    criado_em: Optional[datetime] = None
    total_aulas: int = 0
    detalhes: Optional[Dict[str, Any]] = None
    aulas: List[Aula] = []

    model_config = {"from_attributes": True}
