from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database.connection import get_db
import unicodedata

from pydantic import BaseModel

from database.models import DisciplinaDB, ProfessorDB, TurmaDB
from models.disciplina import Disciplina

router = APIRouter(prefix="/disciplinas", tags=["disciplinas"])


class DisciplinaAtualizacao(BaseModel):
    """Só os campos enviados mudam (ex.: renomear sem perder área, sala e aula dobrada)."""
    nome: Optional[str] = None
    quantidade_aulas: Optional[int] = None
    area: Optional[str] = None
    tipo_sala: Optional[str] = None
    aula_dobrada: Optional[bool] = None


def _chave(nome: str) -> str:
    """Compara nomes sem acento e sem caixa, como no restante do sistema."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFD", nome or "") if not unicodedata.combining(c))
    return sem_acento.strip().casefold()


def _nome_valido(db: Session, nome: str, ignorar_id: Optional[int] = None) -> str:
    nome = (nome or "").strip()
    if not nome:
        raise HTTPException(status_code=422, detail="Informe o nome da disciplina.")
    for d in db.query(DisciplinaDB).all():
        if d.id != ignorar_id and _chave(d.nome) == _chave(nome):
            raise HTTPException(status_code=409, detail=f"Já existe uma disciplina chamada {d.nome}.")
    return nome


def _turmas_com(db: Session, nome: str) -> List[TurmaDB]:
    chave = _chave(nome)
    return [
        t
        for t in db.query(TurmaDB).all()
        if any(_chave(item.get("disciplina", "")) == chave for item in (t.matriz_curricular or []))
    ]


@router.post("/", response_model=Disciplina, status_code=status.HTTP_201_CREATED)
def criar_disciplina(disciplina: Disciplina, db: Session = Depends(get_db)):
    db_disc = DisciplinaDB(
        nome=_nome_valido(db, disciplina.nome),
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
def atualizar_disciplina(disciplina_id: int, disciplina: DisciplinaAtualizacao, db: Session = Depends(get_db)):
    """
    Atualiza os campos enviados. Renomear também troca o nome nas matrizes curriculares (que
    guardam a disciplina pelo nome); grades já geradas continuam com o nome antigo.
    """
    db_disc = db.query(DisciplinaDB).filter(DisciplinaDB.id == disciplina_id).first()
    if not db_disc:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada")
    campos = disciplina.model_dump(exclude_unset=True)
    if "nome" in campos:
        novo = _nome_valido(db, campos.pop("nome"), ignorar_id=disciplina_id)
        antigo = db_disc.nome
        if novo != antigo:
            for t in _turmas_com(db, antigo):
                # Lista nova para o SQLAlchemy perceber a mudança na coluna JSON
                t.matriz_curricular = [
                    {**item, "disciplina": novo} if _chave(item.get("disciplina", "")) == _chave(antigo) else item
                    for item in t.matriz_curricular
                ]
            db_disc.nome = novo
    for campo, valor in campos.items():
        setattr(db_disc, campo, valor)
    db.commit()
    db.refresh(db_disc)
    return db_disc


@router.delete("/{disciplina_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_disciplina(
    disciplina_id: int,
    tirar_das_matrizes: bool = Query(False, description="Também tira a disciplina das matrizes das turmas"),
    db: Session = Depends(get_db),
):
    """
    Exclui a disciplina e a tira do cadastro dos professores. Se ela estiver em alguma matriz,
    só sai com tirar_das_matrizes=true (as aulas dela saem dessas matrizes). Grades já geradas
    não mudam.
    """
    db_disc = db.query(DisciplinaDB).filter(DisciplinaDB.id == disciplina_id).first()
    if not db_disc:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada")

    turmas = _turmas_com(db, db_disc.nome)
    if turmas and not tirar_das_matrizes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{db_disc.nome} está na matriz de {', '.join(t.nome for t in turmas)}. Tire das matrizes antes de excluir.",
        )
    chave = _chave(db_disc.nome)
    for t in turmas:
        t.matriz_curricular = [i for i in t.matriz_curricular if _chave(i.get("disciplina", "")) != chave]

    for prof in db.query(ProfessorDB).all():
        if prof.disciplinas and disciplina_id in prof.disciplinas:
            prof.disciplinas = [d for d in prof.disciplinas if d != disciplina_id]
    db.delete(db_disc)
    db.commit()
