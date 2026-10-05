from fastapi import APIRouter
from typing import List
from models.professor import Professor

router = APIRouter(prefix="/professores", tags=["professores"])

# Lista em memória para simular o banco de dados
professores_db = []
current_id = 1

@router.post("/", response_model=Professor)
def criar_professor(professor: Professor):
    global current_id
    professor.id = current_id
    professores_db.append(professor)
    current_id += 1
    return professor

@router.get("/", response_model=List[Professor])
def listar_professores():
    return professores_db
