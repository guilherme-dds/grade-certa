from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from database.connection import get_db
from database.models import DisciplinaDB
from models.disciplina import Disciplina

router = APIRouter(prefix="/disciplinas", tags=["disciplinas"])


@router.post("/", response_model=Disciplina, status_code=status.HTTP_201_CREATED)
def criar_disciplina(disciplina: Disciplina, db: Session = Depends(get_db)):
    db_disc = DisciplinaDB(
        nome=disciplina.nome,
        quantidade_aulas=disciplina.quantidade_aulas,
    )
    db.add(db_disc)
    db.commit()
    db.refresh(db_disc)
    return db_disc


@router.get("/", response_model=List[Disciplina])
def listar_disciplinas(db: Session = Depends(get_db)):
    return db.query(DisciplinaDB).all()
