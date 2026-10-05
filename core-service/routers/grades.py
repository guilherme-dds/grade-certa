from fastapi import APIRouter

router = APIRouter(prefix="/grade", tags=["grade"])

# Grade simulada
grade_gerada = {
    "aulas": []
}

@router.post("/gerar-grade")
def gerar_grade():
    # Aqui ocorreria a chamada para o algoritmo do Google OR-Tools
    return {"mensagem": "Algoritmo de geração de grade (Google OR-Tools) acionado com sucesso. A grade está sendo gerada."}

@router.get("/")
def visualizar_grade():
    # Retorna a grade gerada (simulada)
    return grade_gerada
