import logging
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.connection import Base, SessionLocal, engine
import database.models  # Garante que os modelos SQLAlchemy sejam importados
from database.migracoes import adicionar_colunas, marcar_geracoes_interrompidas, vincular_professores_por_id
from routers import professores, turmas, disciplinas, disponibilidades, grades, salas, configuracoes
from services.autenticacao import usuario_autenticado

# O token do login é validado com a mesma chave do auth-service
if not os.getenv("SECRET_KEY"):
    raise RuntimeError("A variável SECRET_KEY não está definida no arquivo .env ou no ambiente.")

# Mensagens das migrações no log do container (o uvicorn só configura os próprios loggers;
# um basicConfig em INFO também mostraria todo SQL do SQLAlchemy)
_log_migracoes = logging.getLogger("database.migracoes")
_log_migracoes.setLevel(logging.INFO)
_log_migracoes.addHandler(logging.StreamHandler())

# Tabelas novas pelo create_all; colunas novas e ajustes de dados pelas migrações
Base.metadata.create_all(bind=engine)
adicionar_colunas(engine)
vincular_professores_por_id(SessionLocal)
marcar_geracoes_interrompidas(engine)

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

# Todas as rotas exigem login (token do auth-service)
for modulo in (professores, turmas, disciplinas, disponibilidades, grades, salas, configuracoes):
    app.include_router(modulo.router, dependencies=[Depends(usuario_autenticado)])


@app.get("/")
def read_root():
    return {"message": "Bem-vindo ao Core Service do Grade Certa!"}
