from fastapi import FastAPI
from routers import professores, turmas, disciplinas, disponibilidades, grades

app = FastAPI(
    title="Grade Certa - Core Service",
    description="Microsserviço principal responsável pela gestão de entidades e geração da grade de horários.",
    version="1.0.0"
)

# Inclui as rotas separadas
app.include_router(professores.router)
app.include_router(turmas.router)
app.include_router(disciplinas.router)
app.include_router(disponibilidades.router)
app.include_router(grades.router)

@app.get("/")
def read_root():
    return {"message": "Bem-vindo ao Core Service do Grade Certa!"}
