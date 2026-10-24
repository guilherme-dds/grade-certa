from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from database.connection import get_db
from database.models import SalaDB, IndisponibilidadeSalaDB
from models.sala import Sala, IndisponibilidadeSala

router = APIRouter(prefix="/salas", tags=["salas"])


def _get_sala_or_404(sala_id: int, db: Session) -> SalaDB:
    db_sala = db.query(SalaDB).filter(SalaDB.id == sala_id).first()
    if not db_sala:
        raise HTTPException(status_code=404, detail="Sala não encontrada")
    return db_sala


@router.post("/", response_model=Sala, status_code=status.HTTP_201_CREATED)
def criar_sala(sala: Sala, db: Session = Depends(get_db)):
    db_sala = SalaDB(nome=sala.nome, capacidade=sala.capacidade, tipo=sala.tipo)
    db_sala.indisponibilidades = [
        IndisponibilidadeSalaDB(**ind.model_dump(exclude={"id"})) for ind in sala.indisponibilidades
    ]
    db.add(db_sala)
    db.commit()
    db.refresh(db_sala)
    return db_sala


@router.get("/", response_model=List[Sala])
def listar_salas(db: Session = Depends(get_db)):
    return db.query(SalaDB).options(joinedload(SalaDB.indisponibilidades)).all()


@router.put("/{sala_id}", response_model=Sala)
def atualizar_sala(sala_id: int, sala: Sala, db: Session = Depends(get_db)):
    """Atualiza a sala; a lista de horários indisponíveis só é substituída se for enviada."""
    db_sala = _get_sala_or_404(sala_id, db)
    db_sala.nome = sala.nome
    db_sala.capacidade = sala.capacidade
    db_sala.tipo = sala.tipo
    if "indisponibilidades" in sala.model_fields_set:
        db_sala.indisponibilidades = [
            IndisponibilidadeSalaDB(**ind.model_dump(exclude={"id"})) for ind in sala.indisponibilidades
        ]
    db.commit()
    db.refresh(db_sala)
    return db_sala


@router.delete("/{sala_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_sala(sala_id: int, db: Session = Depends(get_db)):
    db_sala = _get_sala_or_404(sala_id, db)
    db.delete(db_sala)
    db.commit()
    return None


@router.post(
    "/{sala_id}/indisponibilidades",
    response_model=IndisponibilidadeSala,
    status_code=status.HTTP_201_CREATED,
)
def adicionar_indisponibilidade(
    sala_id: int, indisponibilidade: IndisponibilidadeSala, db: Session = Depends(get_db)
):
    """Marca um horário em que a sala está ocupada por outra atividade."""
    _get_sala_or_404(sala_id, db)
    db_ind = IndisponibilidadeSalaDB(sala_id=sala_id, **indisponibilidade.model_dump(exclude={"id"}))
    db.add(db_ind)
    db.commit()
    db.refresh(db_ind)
    return db_ind


@router.delete("/{sala_id}/indisponibilidades/{ind_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_indisponibilidade(sala_id: int, ind_id: int, db: Session = Depends(get_db)):
    db_ind = (
        db.query(IndisponibilidadeSalaDB)
        .filter(IndisponibilidadeSalaDB.id == ind_id, IndisponibilidadeSalaDB.sala_id == sala_id)
        .first()
    )
    if not db_ind:
        raise HTTPException(status_code=404, detail="Indisponibilidade não encontrada")
    db.delete(db_ind)
    db.commit()
    return None
