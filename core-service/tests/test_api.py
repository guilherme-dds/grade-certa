import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.connection import Base, get_db
from database.models import AulaDB, GradeDB, ProfessorDB, SalaDB, TurmaDB
from routers import grades, professores, salas, turmas


@pytest.fixture
def ctx():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    for r in (grades, professores, salas, turmas):
        app.include_router(r.router)
    app.dependency_overrides[get_db] = _db
    return TestClient(app), Session()


def _grade_basica(db):
    """Duas turmas de Anos Finais (manhã), uma aula cada, com professores diferentes."""
    ana = ProfessorDB(nome="Ana", email="ana@x.com")
    bia = ProfessorDB(nome="Bia", email="bia@x.com")
    t6 = TurmaDB(nome="6º Ano A", turno="Manhã", nivel_ensino="Anos Finais")
    t7 = TurmaDB(nome="7º Ano A", turno="Manhã", nivel_ensino="Anos Finais")
    db.add_all([ana, bia, t6, t7, SalaDB(nome="Quadra", tipo="Educação física", capacidade=50)])
    db.flush()
    grade = GradeDB(nome="G", status="sucesso", total_aulas=2)
    grade.aulas = [
        AulaDB(turma_id=t6.id, turma_nome=t6.nome, disciplina_nome="Matemática", professor_id=ana.id,
               professor_nome="Ana", dia_semana="Seg", horario="07:20 - 08:10", ordem=1),
        AulaDB(turma_id=t7.id, turma_nome=t7.nome, disciplina_nome="Português", professor_id=bia.id,
               professor_nome="Bia", dia_semana="Seg", horario="07:20 - 08:10", ordem=1),
    ]
    db.add(grade)
    db.commit()
    return grade, ana, bia


def test_horarios_e_grade_trazem_horarios_das_turmas(ctx):
    client, db = ctx
    grade, *_ = _grade_basica(db)
    horarios = client.get("/grades/horarios").json()
    assert horarios["dias"] == ["Seg", "Ter", "Qua", "Qui", "Sex"]
    assert len(horarios["niveis"]["Anos Finais"]["manha"]) == 6

    resposta = client.get("/grades/", params={"grade_id": grade.id}).json()
    assert len(resposta["aulas"]) == 2
    assert resposta["horarios_turmas"][str(grade.aulas[0].turma_id)][0] == "07:20 - 08:10"


def test_editar_aula_gera_conflito_e_sugestao(ctx):
    client, db = ctx
    grade, ana, _ = _grade_basica(db)
    aula_port = grade.aulas[1]
    assert client.get(f"/grades/{grade.id}/conflitos").json() == []

    # Ana passa a dar Português no mesmo horário em que dá Matemática no 6º ano
    r = client.put(f"/grades/aulas/{aula_port.id}", json={
        "dia_semana": "Seg", "horario": "07:20 - 08:10", "professor_ids": [ana.id], "sala_nome": "Quadra",
    })
    assert r.status_code == 200, r.text
    assert r.json()["professor_nome"] == "Ana"

    conflitos = client.get(f"/grades/{grade.id}/conflitos").json()
    assert [c["tipo"] for c in conflitos] == ["Professor duplicado"]
    c = conflitos[0]
    assert c["aula_id"] == aula_port.id
    assert c["correcao"] == {"dia_semana": "Seg", "horario": "08:10 - 09:00"}

    # Aplicar a sugestão resolve
    r = client.put(f"/grades/aulas/{aula_port.id}", json={**c["correcao"], "professor_ids": [ana.id], "sala_nome": "Quadra"})
    assert r.status_code == 200
    assert client.get(f"/grades/{grade.id}/conflitos").json() == []


def test_editar_aula_recusa_choque_de_turma_e_horario_invalido(ctx):
    client, db = ctx
    grade, ana, _ = _grade_basica(db)
    t6 = grade.aulas[0].turma_id
    db.add(AulaDB(grade_id=grade.id, turma_id=t6, turma_nome="6º Ano A", disciplina_nome="Arte",
                  dia_semana="Ter", horario="07:20 - 08:10", ordem=1))
    db.commit()

    r = client.put(f"/grades/aulas/{grade.aulas[0].id}", json={"dia_semana": "Ter", "horario": "07:20 - 08:10"})
    assert r.status_code == 409
    assert "Arte" in r.json()["detail"]

    r = client.put(f"/grades/aulas/{grade.aulas[0].id}", json={"dia_semana": "Ter", "horario": "13:00 - 13:50"})
    assert r.status_code == 400


def test_disponibilidade_do_professor_e_conflito_de_indisponibilidade(ctx):
    client, db = ctx
    grade, ana, _ = _grade_basica(db)

    itens = [
        {"dia_semana": "Seg", "horario_inicio": "07:20", "horario_fim": "08:10",
         "tipo": "indisponivel", "nivel_ensino": "Anos Finais"},
        {"dia_semana": "Ter", "horario_inicio": "07:20", "horario_fim": "08:10", "tipo": "preferencial"},
    ]
    r = client.put(f"/professores/{ana.id}/disponibilidades", json=itens)
    assert r.status_code == 200, r.text
    assert len(client.get(f"/professores/{ana.id}/disponibilidades").json()) == 2
    assert client.get(f"/professores/{ana.id}").json()["disponibilidade_atualizada_em"] is not None

    conflitos = client.get(f"/grades/{grade.id}/conflitos").json()
    assert [c["tipo"] for c in conflitos] == ["Professor indisponível"]

    # Salvar de novo substitui a lista
    client.put(f"/professores/{ana.id}/disponibilidades", json=[])
    assert client.get(f"/professores/{ana.id}/disponibilidades").json() == []
    assert client.get(f"/grades/{grade.id}/conflitos").json() == []


def test_aula_com_varios_professores_detecta_conflito_de_cada_um(ctx):
    client, db = ctx
    grade, ana, bia = _grade_basica(db)
    mat, port = grade.aulas
    # Matemática passa a ser dada por Ana e Bia juntas, no mesmo horário do Português da Bia
    r = client.put(f"/grades/aulas/{mat.id}", json={
        "dia_semana": "Seg", "horario": "07:20 - 08:10", "professor_ids": [ana.id, bia.id], "sala_nome": None,
    })
    assert r.status_code == 200, r.text
    assert [p["nome"] for p in r.json()["professores"]] == ["Ana", "Bia"]
    assert r.json()["professor_nome"] == "Ana"

    conflitos = client.get(f"/grades/{grade.id}/conflitos").json()
    assert [(c["tipo"], c["descricao"].split(" ")[0]) for c in conflitos] == [("Professor duplicado", "Bia")]

    # Aulas antigas (sem a coluna professores) continuam aparecendo com o professor principal
    port.professores = None
    db.commit()
    aula = next(a for a in client.get("/grades/", params={"grade_id": grade.id}).json()["aulas"] if a["id"] == port.id)
    assert aula["professores"] == [{"id": bia.id, "nome": "Bia"}]


def test_matriz_salva_horarios_fixos_e_extra(ctx):
    client, _ = ctx
    item = {
        "disciplina": "Laboratório", "aulas_semanais": 2, "professores": ["Bio", "Fís"], "extra": True,
        "horarios_fixos": [{"dia_semana": "Qua", "horario": "13:50 - 14:40"}, {"dia_semana": "Qua", "horario": "14:40 - 15:30"}],
    }
    r = client.post("/turmas/", json={"nome": "1º EM A", "turno": "Manhã", "matriz_curricular": [item]})
    assert r.status_code == 201, r.text
    salvo = r.json()["matriz_curricular"][0]
    assert salvo["extra"] is True and salvo["professor"] == "Bio"
    assert salvo["horarios_fixos"][1] == {"dia_semana": "Qua", "horario": "14:40 - 15:30"}

    item["aulas_semanais"] = 1  # menos aulas que horários fixos
    r = client.post("/turmas/", json={"nome": "1º EM B", "turno": "Manhã", "matriz_curricular": [item]})
    assert r.status_code == 422


def test_turma_manha_e_tardes_salva_dias(ctx):
    client, _ = ctx
    turma = {"nome": "2º EM A", "turno": "Manhã + tardes", "nivel_ensino": "Ensino Médio", "tardes": ["Sex", "Qua"]}
    r = client.post("/turmas/", json=turma)
    assert r.status_code == 201, r.text
    assert r.json()["tardes"] == ["Qua", "Sex"]  # na ordem da semana

    r = client.post("/turmas/", json={**turma, "tardes": ["Sábado"]})
    assert r.status_code == 422
