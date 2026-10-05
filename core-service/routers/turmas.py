from fastapi import APIRouter
from typing import List
from models.turma import Turma

router = APIRouter(prefix="/turmas", tags=["turmas"])

turmas_db = []
current_id = 1

@router.post("/", response_model=Turma)
def criar_turma(turma: Turma):
    global current_id
    turma.id = current_id
    turmas_db.append(turma)
    current_id += 1
    return turma

@router.get("/", response_model=List[Turma])
def listar_turmas():
    return turmas_db
