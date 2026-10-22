from fastapi import APIRouter, Depends, HTTPException, status
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
        area=disciplina.area,
        tipo_sala=disciplina.tipo_sala,
        aula_dobrada=disciplina.aula_dobrada,
    )
    db.add(db_disc)
    db.commit()
    db.refresh(db_disc)
    return db_disc


@router.get("/", response_model=List[Disciplina])
def listar_disciplinas(db: Session = Depends(get_db)):
    return db.query(DisciplinaDB).all()


@router.put("/{disciplina_id}", response_model=Disciplina)
def atualizar_disciplina(disciplina_id: int, disciplina: Disciplina, db: Session = Depends(get_db)):
    db_disc = db.query(DisciplinaDB).filter(DisciplinaDB.id == disciplina_id).first()
    if not db_disc:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada")
    db_disc.nome = disciplina.nome
    db_disc.quantidade_aulas = disciplina.quantidade_aulas
    db_disc.area = disciplina.area
    db_disc.tipo_sala = disciplina.tipo_sala
    db_disc.aula_dobrada = disciplina.aula_dobrada
    db.commit()
    db.refresh(db_disc)
    return db_disc
