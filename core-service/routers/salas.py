from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database.connection import get_db
from database.models import SalaDB
from models.sala import Sala

router = APIRouter(prefix="/salas", tags=["salas"])


@router.post("/", response_model=Sala, status_code=status.HTTP_201_CREATED)
def criar_sala(sala: Sala, db: Session = Depends(get_db)):
    nome_formatado = sala.nome.strip()
    existente = db.query(SalaDB).filter(SalaDB.nome.ilike(nome_formatado)).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma sala com esse nome.",
        )

    db_sala = SalaDB(
        nome=nome_formatado,
        capacidade=sala.capacidade,
        tipo=sala.tipo,
    )
    db.add(db_sala)
    db.commit()
    db.refresh(db_sala)
    return db_sala


@router.get("/", response_model=List[Sala])
def listar_salas(db: Session = Depends(get_db)):
    return db.query(SalaDB).all()


@router.get("/{sala_id}", response_model=Sala)
def obter_sala(sala_id: int, db: Session = Depends(get_db)):
    sala = db.query(SalaDB).filter(SalaDB.id == sala_id).first()
    if not sala:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sala não encontrada",
        )
    return sala


@router.put("/{sala_id}", response_model=Sala)
def atualizar_sala(sala_id: int, sala: Sala, db: Session = Depends(get_db)):
    db_sala = db.query(SalaDB).filter(SalaDB.id == sala_id).first()
    if not db_sala:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sala não encontrada",
        )

    nome_formatado = sala.nome.strip()
    existente = (
        db.query(SalaDB)
        .filter(SalaDB.nome.ilike(nome_formatado), SalaDB.id != sala_id)
        .first()
    )
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe uma sala com esse nome.",
        )

    db_sala.nome = nome_formatado
    db_sala.capacidade = sala.capacidade
    db_sala.tipo = sala.tipo

    db.commit()
    db.refresh(db_sala)
    return db_sala


@router.delete("/{sala_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_sala(sala_id: int, db: Session = Depends(get_db)):
    db_sala = db.query(SalaDB).filter(SalaDB.id == sala_id).first()
    if not db_sala:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sala não encontrada",
        )
    db.delete(db_sala)
    db.commit()
    return None
