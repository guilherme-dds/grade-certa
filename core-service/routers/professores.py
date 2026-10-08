from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database.connection import get_db
from database.models import ProfessorDB
from models.professor import Professor

router = APIRouter(prefix="/professores", tags=["professores"])


@router.post("/", response_model=Professor, status_code=status.HTTP_201_CREATED)
def criar_professor(professor: Professor, db: Session = Depends(get_db)):
    db_prof = ProfessorDB(
        nome=professor.nome,
        email=professor.email,
        niveis_ensino=professor.niveis_ensino,
        disciplinas=professor.disciplinas,
        carga_maxima_aulas=professor.carga_maxima_aulas,
        ativo=professor.ativo,
    )
    db.add(db_prof)
    db.commit()
    db.refresh(db_prof)
    return db_prof


@router.get("/", response_model=List[Professor])
def listar_professores(
    ativo: Optional[bool] = Query(None, description="Filtrar por status de atividade"),
    disciplina_id: Optional[int] = Query(None, description="Filtrar por ID de disciplina"),
    nivel_ensino: Optional[str] = Query(None, description="Filtrar por nível de ensino"),
    db: Session = Depends(get_db),
):
    query = db.query(ProfessorDB)
    if ativo is not None:
        query = query.filter(ProfessorDB.ativo == ativo)

    professores = query.all()

    if disciplina_id is not None:
        professores = [
            p for p in professores if p.disciplinas and disciplina_id in p.disciplinas
        ]

    if nivel_ensino is not None:
        professores = [
            p
            for p in professores
            if p.niveis_ensino
            and any(n.lower() == nivel_ensino.lower() for n in p.niveis_ensino)
        ]

    return professores


@router.get("/{professor_id}", response_model=Professor)
def obter_professor(professor_id: int, db: Session = Depends(get_db)):
    prof = db.query(ProfessorDB).filter(ProfessorDB.id == professor_id).first()
    if not prof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado"
        )
    return prof


@router.put("/{professor_id}", response_model=Professor)
def atualizar_professor(
    professor_id: int, professor_atualizado: Professor, db: Session = Depends(get_db)
):
    prof = db.query(ProfessorDB).filter(ProfessorDB.id == professor_id).first()
    if not prof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado"
        )

    prof.nome = professor_atualizado.nome
    prof.email = professor_atualizado.email
    prof.niveis_ensino = professor_atualizado.niveis_ensino
    prof.disciplinas = professor_atualizado.disciplinas
    prof.carga_maxima_aulas = professor_atualizado.carga_maxima_aulas
    prof.ativo = professor_atualizado.ativo

    db.commit()
    db.refresh(prof)
    return prof


@router.delete("/{professor_id}")
def deletar_professor(professor_id: int, db: Session = Depends(get_db)):
    prof = db.query(ProfessorDB).filter(ProfessorDB.id == professor_id).first()
    if not prof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado"
        )

    db.delete(prof)
    db.commit()
    return {"mensagem": f"Professor {professor_id} removido com sucesso"}
