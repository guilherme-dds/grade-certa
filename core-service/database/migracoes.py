"""
Ajustes do banco feitos na subida do core-service, depois do `create_all` (que só cria
tabelas novas e não adiciona colunas a tabelas que já existem).

Cada coluna só é adicionada se ainda não existir, então rodar de novo não faz nada. Uma
falha ao adicionar coluna é registrada e impede a subida: com a coluna faltando, o
serviço quebraria depois, em qualquer consulta à tabela.
"""
import logging
from typing import List, Tuple

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# (tabela, coluna, tipo) das colunas criadas depois da primeira versão das tabelas
COLUNAS: List[Tuple[str, str, str]] = [
    ("turmas", "matriz_curricular", "JSON NULL"),
    ("turmas", "nivel_ensino", "VARCHAR(100) NULL"),
    ("turmas", "sala_id", "INT NULL"),
    ("turmas", "tardes", "JSON NULL"),
    ("disciplinas", "area", "VARCHAR(100) NULL"),
    ("disciplinas", "tipo_sala", "VARCHAR(100) NULL"),
    ("disciplinas", "aula_dobrada", "BOOLEAN NULL"),
    ("disponibilidades", "tipo", "VARCHAR(20) NOT NULL DEFAULT 'indisponivel'"),
    ("disponibilidades", "nivel_ensino", "VARCHAR(100) NULL"),
    ("professores", "disponibilidade_atualizada_em", "DATETIME NULL"),
    ("professores", "jornada", "JSON NULL"),
    ("aulas", "professores", "JSON NULL"),
    ("configuracoes_escola", "max_horas_dia", "FLOAT NULL DEFAULT 9"),
]


def adicionar_colunas(engine: Engine) -> List[str]:
    """Adiciona as colunas que faltam; devolve as adicionadas ("tabela.coluna")."""
    inspetor = inspect(engine)
    tabelas = set(inspetor.get_table_names())
    adicionadas = []
    for tabela, coluna, tipo in COLUNAS:
        # Tabela que ainda não existe é criada inteira pelo create_all
        if tabela not in tabelas or coluna in {c["name"] for c in inspetor.get_columns(tabela)}:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {tipo}"))
        except Exception:
            logger.exception("Migração: não foi possível adicionar a coluna %s.%s", tabela, coluna)
            raise
        logger.info("Migração: coluna %s.%s adicionada", tabela, coluna)
        adicionadas.append(f"{tabela}.{coluna}")
    return adicionadas


def vincular_professores_por_id(session_factory) -> None:
    """Matrizes salvas com o nome do professor passam a guardar o id do cadastro."""
    from database.models import ProfessorDB, TurmaDB
    from services.grid_solver import normalizar
    from services.vinculo_professores import vincular_por_id

    try:
        with session_factory() as db:
            id_por_nome = {normalizar(p.nome): p.id for p in db.query(ProfessorDB).all()}
            for turma in db.query(TurmaDB).all():
                vinculada = vincular_por_id(turma.matriz_curricular, id_por_nome)
                if vinculada != (turma.matriz_curricular or []):
                    turma.matriz_curricular = vinculada
            db.commit()
    except Exception:
        # As matrizes antigas continuam funcionando pelo nome; o gerador também converte
        logger.exception("Migração: não foi possível vincular os professores das matrizes pelo id")

