from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database.connection import get_db
from database.models import TurmaDB
from models.turma import Turma

router = APIRouter(prefix="/turmas", tags=["turmas"])


@router.post("/", response_model=Turma, status_code=status.HTTP_201_CREATED)
def criar_turma(turma: Turma, db: Session = Depends(get_db)):
    matriz = [item.dict() for item in turma.matriz_curricular] if turma.matriz_curricular else []
    db_turma = TurmaDB(
        nome=turma.nome,
        turno=turma.turno,
        matriz_curricular=matriz,
    )
    db.add(db_turma)
    db.commit()
    db.refresh(db_turma)
    return db_turma


@router.get("/", response_model=List[Turma])
def listar_turmas(db: Session = Depends(get_db)):
    return db.query(TurmaDB).all()


@router.put("/{turma_id}", response_model=Turma)
def atualizar_turma(turma_id: int, turma: Turma, db: Session = Depends(get_db)):
    db_turma = db.query(TurmaDB).filter(TurmaDB.id == turma_id).first()
    if not db_turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    db_turma.nome = turma.nome
    db_turma.turno = turma.turno
    if turma.matriz_curricular is not None:
        db_turma.matriz_curricular = [item.dict() for item in turma.matriz_curricular]
    db.commit()
    db.refresh(db_turma)
    return db_turma


@router.delete("/{turma_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_turma(turma_id: int, db: Session = Depends(get_db)):
    db_turma = db.query(TurmaDB).filter(TurmaDB.id == turma_id).first()
    if not db_turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    db.delete(db_turma)
    db.commit()
    return None

