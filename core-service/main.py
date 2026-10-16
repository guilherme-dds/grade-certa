from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.connection import Base, engine, SessionLocal
import database.models  # Garante que os modelos SQLAlchemy sejam importados
from routers import professores, turmas, disciplinas, disponibilidades, grades, salas

from sqlalchemy import text

# Cria automaticamente as tabelas no MySQL se não existirem
Base.metadata.create_all(bind=engine)

# Popula salas padrão se a tabela estiver vazia
try:
    with SessionLocal() as db:
        if db.query(database.models.SalaDB).count() == 0:
            salas_iniciais = [
                database.models.SalaDB(nome="Sala 101", capacidade=35, tipo="Sala comum"),
                database.models.SalaDB(nome="Sala 102", capacidade=35, tipo="Sala comum"),
                database.models.SalaDB(nome="Laboratório de Ciências", capacidade=28, tipo="Laboratório"),
                database.models.SalaDB(nome="Laboratório de Informática", capacidade=30, tipo="Laboratório"),
                database.models.SalaDB(nome="Quadra Poliesportiva", capacidade=50, tipo="Educação física"),
            ]
            db.add_all(salas_iniciais)
            db.commit()
except Exception:
    pass

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
app.include_router(salas.router)



@app.get("/")
def read_root():
    return {"message": "Bem-vindo ao Core Service do Grade Certa!"}
