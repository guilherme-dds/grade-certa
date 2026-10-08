from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database.connection import get_db
from database.models import TurmaDB
from models.turma import Turma

router = APIRouter(prefix="/turmas", tags=["turmas"])


@router.post("/", response_model=Turma, status_code=status.HTTP_201_CREATED)
def criar_turma(turma: Turma, db: Session = Depends(get_db)):
    db_turma = TurmaDB(
        nome=turma.nome,
        turno=turma.turno,
    )
    db.add(db_turma)
    db.commit()
    db.refresh(db_turma)
    return db_turma


@router.get("/", response_model=List[Turma])
def listar_turmas(db: Session = Depends(get_db)):
    return db.query(TurmaDB).all()
