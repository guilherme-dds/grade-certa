from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional
from models.professor import Professor

router = APIRouter(prefix="/professores", tags=["professores"])

# Lista em memória para simular o banco de dados
professores_db: List[Professor] = []
current_id = 1


@router.post("/", response_model=Professor, status_code=status.HTTP_201_CREATED)
def criar_professor(professor: Professor):
    global current_id
    professor.id = current_id
    professores_db.append(professor)
    current_id += 1
    return professor


@router.get("/", response_model=List[Professor])
def listar_professores(
    ativo: Optional[bool] = Query(None, description="Filtrar por status de atividade"),
    disciplina_id: Optional[int] = Query(None, description="Filtrar por ID de disciplina"),
):
    resultado = professores_db
    if ativo is not None:
        resultado = [p for p in resultado if p.ativo == ativo]
    if disciplina_id is not None:
        resultado = [p for p in resultado if disciplina_id in p.disciplinas]
    return resultado


@router.get("/{professor_id}", response_model=Professor)
def obter_professor(professor_id: int):
    for prof in professores_db:
        if prof.id == professor_id:
            return prof
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado")


@router.put("/{professor_id}", response_model=Professor)
def atualizar_professor(professor_id: int, professor_atualizado: Professor):
    for idx, prof in enumerate(professores_db):
        if prof.id == professor_id:
            professor_atualizado.id = professor_id
            professores_db[idx] = professor_atualizado
            return professor_atualizado
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado")


@router.delete("/{professor_id}")
def deletar_professor(professor_id: int):
    for idx, prof in enumerate(professores_db):
        if prof.id == professor_id:
            professores_db.pop(idx)
            return {"mensagem": f"Professor {professor_id} removido com sucesso"}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor não encontrado")
