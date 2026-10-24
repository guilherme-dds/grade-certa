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
    # Horários de cada turma (turma_id -> horários), para exibir e editar a grade
    horarios_turmas: Dict[int, List[str]] = {}

    model_config = {"from_attributes": True}


class AulaUpdate(BaseModel):
    """Edição manual de uma aula: substitui dia, horário, professor e sala."""
    dia_semana: str
    horario: str
    professor_id: Optional[int] = None
    sala_nome: Optional[str] = None
