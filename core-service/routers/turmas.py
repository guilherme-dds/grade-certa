from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database.connection import get_db
from database.models import ProfessorDB, TurmaDB
from models.turma import Turma
from services.grid_solver import normalizar
from services.vinculo_professores import vincular_por_id

router = APIRouter(prefix="/turmas", tags=["turmas"])


def _matriz(db: Session, turma: Turma) -> list:
    """Itens da matriz com os professores cadastrados pelo id (nomes conhecidos também são aceitos)."""
    id_por_nome = {normalizar(p.nome): p.id for p in db.query(ProfessorDB).all()}
    return vincular_por_id([item.model_dump() for item in turma.matriz_curricular or []], id_por_nome)


@router.post("/", response_model=Turma, status_code=status.HTTP_201_CREATED)
def criar_turma(turma: Turma, db: Session = Depends(get_db)):
    matriz = _matriz(db, turma)
    db_turma = TurmaDB(
        nome=turma.nome,
        turno=turma.turno,
        nivel_ensino=turma.nivel_ensino,
        matriz_curricular=matriz,
        sala_id=turma.sala_id,
        tardes=turma.tardes,
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
    db_turma.sala_id = turma.sala_id
    db_turma.tardes = turma.tardes
    if turma.nivel_ensino is not None:
        db_turma.nivel_ensino = turma.nivel_ensino
    if turma.matriz_curricular is not None:
        db_turma.matriz_curricular = _matriz(db, turma)
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

