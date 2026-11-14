from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database.connection import get_db
import unicodedata

from database.models import DisciplinaDB, ProfessorDB, TurmaDB
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


def _chave(nome: str) -> str:
    """Compara nomes sem acento e sem caixa, como no restante do sistema."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFD", nome or "") if not unicodedata.combining(c))
    return sem_acento.strip().casefold()


@router.delete("/{disciplina_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_disciplina(disciplina_id: int, db: Session = Depends(get_db)):
    """Exclui a disciplina e a tira do cadastro dos professores. Disciplina em alguma matriz não pode sair."""
    db_disc = db.query(DisciplinaDB).filter(DisciplinaDB.id == disciplina_id).first()
    if not db_disc:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada")

    chave = _chave(db_disc.nome)
    turmas = [
        t.nome
        for t in db.query(TurmaDB).all()
        if any(_chave(item.get("disciplina", "")) == chave for item in (t.matriz_curricular or []))
    ]
    if turmas:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{db_disc.nome} está na matriz de {', '.join(turmas)}. Tire das matrizes antes de excluir.",
        )

    for prof in db.query(ProfessorDB).all():
        if prof.disciplinas and disciplina_id in prof.disciplinas:
            # Lista nova para o SQLAlchemy perceber a mudança na coluna JSON
            prof.disciplinas = [d for d in prof.disciplinas if d != disciplina_id]
    db.delete(db_disc)
    db.commit()
