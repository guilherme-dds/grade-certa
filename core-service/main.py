from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.connection import Base, engine
import database.models  # Garante que os modelos SQLAlchemy sejam importados
from routers import professores, turmas, disciplinas, disponibilidades, grades, salas

from sqlalchemy import text

# Cria automaticamente as tabelas no MySQL se não existirem
Base.metadata.create_all(bind=engine)

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE turmas ADD COLUMN matriz_curricular JSON NULL;"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE turmas ADD COLUMN nivel_ensino VARCHAR(100) NULL;"))
        conn.commit()
except Exception:
    pass

# Colunas adicionadas depois da criação inicial das tabelas
for ddl in (
    "ALTER TABLE turmas ADD COLUMN sala_id INT NULL;",
    "ALTER TABLE disciplinas ADD COLUMN area VARCHAR(100) NULL;",
    "ALTER TABLE disciplinas ADD COLUMN tipo_sala VARCHAR(100) NULL;",
    "ALTER TABLE disciplinas ADD COLUMN aula_dobrada BOOLEAN NULL;",
    "ALTER TABLE disponibilidades ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'indisponivel';",
    "ALTER TABLE disponibilidades ADD COLUMN nivel_ensino VARCHAR(100) NULL;",
    "ALTER TABLE professores ADD COLUMN disponibilidade_atualizada_em DATETIME NULL;",
    "ALTER TABLE aulas ADD COLUMN professores JSON NULL;",
    "ALTER TABLE turmas ADD COLUMN tardes JSON NULL;",
):
    try:
        with engine.connect() as conn:
            conn.execute(text(ddl))
            conn.commit()
    except Exception:
        pass

# Uma geração que estava rodando quando o serviço parou não vai terminar
try:
    with engine.connect() as conn:
        conn.execute(text(
            "UPDATE grades SET status = 'erro' WHERE status = 'gerando'"
        ))
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
