from fastapi import APIRouter
from typing import List
from models.disponibilidade import Disponibilidade

router = APIRouter(prefix="/disponibilidades", tags=["disponibilidade"])

disponibilidades_db = []
current_id = 1

@router.post("/", response_model=Disponibilidade)
def registrar_disponibilidade(disponibilidade: Disponibilidade):
    global current_id
    disponibilidade.id = current_id
    disponibilidades_db.append(disponibilidade)
    current_id += 1
    return disponibilidade

@router.get("/", response_model=List[Disponibilidade])
def listar_disponibilidades():
    return disponibilidades_db
