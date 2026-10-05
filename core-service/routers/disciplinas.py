from fastapi import APIRouter
from typing import List
from models.disciplina import Disciplina

router = APIRouter(prefix="/disciplinas", tags=["disciplinas"])

disciplinas_db = []
current_id = 1

@router.post("/", response_model=Disciplina)
def criar_disciplina(disciplina: Disciplina):
    global current_id
    disciplina.id = current_id
    disciplinas_db.append(disciplina)
    current_id += 1
    return disciplina

@router.get("/", response_model=List[Disciplina])
def listar_disciplinas():
    return disciplinas_db
