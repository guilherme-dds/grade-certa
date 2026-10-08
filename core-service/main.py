from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.connection import Base, engine
import database.models  # Garante que os modelos SQLAlchemy sejam importados
from routers import professores, turmas, disciplinas, disponibilidades, grades

from sqlalchemy import text

# Cria automaticamente as tabelas no MySQL se não existirem
Base.metadata.create_all(bind=engine)

# Garante que colunas novas como matriz_curricular existam em tabelas já criadas
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE turmas ADD COLUMN matriz_curricular JSON NULL;"))
        conn.commit()
except Exception:
    pass

app = FastAPI(
    title="Grade Certa - Core Service",
    description="Microsserviço principal responsável pela gestão de entidades e geração da grade de horários.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
