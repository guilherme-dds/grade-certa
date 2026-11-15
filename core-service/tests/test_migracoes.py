import logging

import pytest
from sqlalchemy import create_engine, inspect, text

from database.migracoes import COLUNAS, adicionar_colunas, descartar_preferenciais


def _colunas(engine, tabela):
    return {c["name"] for c in inspect(engine).get_columns(tabela)}


def test_adiciona_so_as_colunas_que_faltam(caplog):
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        # Versão antiga: professores sem jornada; aulas já com professores; turmas ainda não existe
        conn.execute(text("CREATE TABLE professores (id INTEGER PRIMARY KEY, nome TEXT, disponibilidade_atualizada_em DATETIME)"))
        conn.execute(text("CREATE TABLE aulas (id INTEGER PRIMARY KEY, professores JSON)"))

    with caplog.at_level(logging.INFO, logger="database.migracoes"):
        assert adicionar_colunas(engine) == ["professores.jornada"]
    assert "jornada" in _colunas(engine, "professores")
    assert "coluna professores.jornada adicionada" in caplog.text

    # Rodar de novo não faz nada
    assert adicionar_colunas(engine) == []


def test_falha_ao_adicionar_coluna_e_registrada_e_interrompe(caplog, monkeypatch):
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE professores (id INTEGER PRIMARY KEY)"))
    monkeypatch.setattr("database.migracoes.COLUNAS", [("professores", "jornada", "TIPO INVÁLIDO ((")])

    with caplog.at_level(logging.ERROR, logger="database.migracoes"), pytest.raises(Exception):
        adicionar_colunas(engine)
    assert "não foi possível adicionar a coluna professores.jornada" in caplog.text


def test_toda_coluna_da_lista_existe_no_modelo():
    from database.connection import Base
    import database.models  # noqa: F401

    for tabela, coluna, _ in COLUNAS:
        assert coluna in Base.metadata.tables[tabela].columns, f"{tabela}.{coluna}"


def test_horarios_preferenciais_antigos_voltam_a_ficar_livres():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE disponibilidades (id INTEGER PRIMARY KEY, tipo TEXT)"))
        conn.execute(text("INSERT INTO disponibilidades (tipo) VALUES ('preferencial'), ('indisponivel'), ('evitar')"))

    assert descartar_preferenciais(engine) == 1
    with engine.begin() as conn:
        tipos = sorted(r[0] for r in conn.execute(text("SELECT tipo FROM disponibilidades")))
    assert tipos == ["evitar", "indisponivel"]
    assert descartar_preferenciais(engine) == 0
    # Banco novo, sem a tabela: nada a fazer
    assert descartar_preferenciais(create_engine("sqlite://")) == 0
