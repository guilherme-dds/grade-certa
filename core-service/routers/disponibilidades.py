from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database.connection import get_db
from database.models import DisponibilidadeDB
from models.disponibilidade import Disponibilidade

router = APIRouter(prefix="/disponibilidades", tags=["disponibilidade"])


@router.post("/", response_model=Disponibilidade, status_code=status.HTTP_201_CREATED)
def registrar_disponibilidade(
    disponibilidade: Disponibilidade, db: Session = Depends(get_db)
):
    db_disp = DisponibilidadeDB(
        professor_id=disponibilidade.professor_id,
        dia_semana=disponibilidade.dia_semana,
        horario_inicio=disponibilidade.horario_inicio,
        horario_fim=disponibilidade.horario_fim,
        tipo=disponibilidade.tipo,
        nivel_ensino=disponibilidade.nivel_ensino,
    )
    db.add(db_disp)
    db.commit()
    db.refresh(db_disp)
    return db_disp


@router.get("/", response_model=List[Disponibilidade])
def listar_disponibilidades(
    professor_id: Optional[int] = Query(None, description="Filtrar por professor"),
    db: Session = Depends(get_db),
):
    query = db.query(DisponibilidadeDB)
    if professor_id is not None:
        query = query.filter(DisponibilidadeDB.professor_id == professor_id)
    return query.all()
