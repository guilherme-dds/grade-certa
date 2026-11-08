import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import AulaDB, GradeDB, ProfessorDB, TurmaDB
from models.jornada import Jornada
from services.grade_conflicts import DetectorConflitos

MANHA = ["07:20 - 08:10", "08:10 - 09:00", "09:00 - 09:50", "10:10 - 11:00", "11:00 - 11:50", "11:50 - 12:40"]
TARDE = ["13:00 - 13:50", "13:50 - 14:40", "14:40 - 15:30", "15:50 - 16:40", "16:40 - 17:30", "17:30 - 18:20"]


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _grade(db, aulas, jornada=None, matriz=None):
    """`aulas` são (professor, turma, disciplina, dia, horário); turmas "…B" são da tarde."""
    profs, turmas = {}, {}
    for prof, turma, *_ in aulas:
        if prof not in profs:
            profs[prof] = ProfessorDB(
                nome=prof, email=f"{prof}@x.com",
                jornada=Jornada(**jornada).model_dump() if jornada and prof == "Ana" else None,
            )
        if turma not in turmas:
            turmas[turma] = TurmaDB(
                nome=turma, turno="Tarde" if turma.endswith("B") else "Manhã", nivel_ensino="Anos Finais",
                matriz_curricular=(matriz or {}).get(turma),
            )
    db.add_all([*profs.values(), *turmas.values()])
    db.flush()
    grade = GradeDB(nome="G", status="sucesso", total_aulas=len(aulas))
    grade.aulas = [
        AulaDB(turma_id=turmas[t].id, turma_nome=t, disciplina_nome=disc, professor_id=profs[p].id, professor_nome=p,
               professores=[{"id": profs[p].id, "nome": p}], dia_semana=dia, horario=h, ordem=1)
        for p, t, disc, dia, h in aulas
    ]
    db.add(grade)
    db.commit()
    return grade


def _manha_completa(turma, dia="Seg", professores=None):
    """Turma com as 6 aulas da manhã, cada uma com um professor (para a primeira/última não interferir)."""
    professores = professores or {}
    return [(professores.get(i, f"P{turma}{i}"), turma, f"Disc{i}", dia, h) for i, h in enumerate(MANHA)]


def _do_tipo(db, grade, tipo):
    return [c for c in DetectorConflitos(db, grade).detectar() if c["tipo"] == tipo]


def test_aulas_demais_no_dia(db):
    aulas = (
        _manha_completa("6A", professores={0: "Ana"})
        + _manha_completa("7A", professores={1: "Ana"})
        + _manha_completa("8A", professores={2: "Ana"})
    )
    grade = _grade(db, aulas, jornada={"max_aulas_dia": 2})

    [c] = _do_tipo(db, grade, "Aulas demais no dia")
    assert c["descricao"] == "Ana tem 3 aulas em Seg; o máximo é 2."
    assert c["turma_nome"] == "8A"
    # Sair da segunda resolve; trocar de horário na própria segunda, não
    assert c["correcao"]["dia_semana"] != "Seg"


def test_dia_longo_demais(db):
    aulas = _manha_completa("6A", professores={0: "Ana"}) + _manha_completa("7A", professores={2: "Ana"})
    grade = _grade(db, aulas, jornada={"max_horas_dia": 1})

    [c] = _do_tipo(db, grade, "Dia longo demais")
    assert c["descricao"] == "Ana fica das 07:20 às 09:50 em Seg, acima do máximo de 1 h."
    assert c["turma_nome"] == "7A"
    assert c["correcao"]["dia_semana"] != "Seg"


def test_sem_almoco_e_almoco_que_cabe(db):
    aulas = [
        ("Ana", "6A", "Mat", "Seg", MANHA[4]), ("Ana", "6A", "Mat", "Seg", MANHA[5]),
        ("Ana", "7B", "Mat", "Seg", TARDE[0]), ("Ana", "7B", "Mat", "Seg", TARDE[1]),
    ]
    grade = _grade(db, aulas)

    # Almoço padrão: 40 min entre 11:30 e 14:30; das 11:00 às 14:40 sem intervalo
    [c] = _do_tipo(db, grade, "Sem almoço")
    assert c["descricao"] == "Ana não tem 40 min livres entre 11:30 e 14:30 em Seg."
    assert c["turma_nome"] == "7B"
    assert c["correcao"] is not None

    # Sem a aula das 13:00, o almoço cabe entre 12:40 e 13:50
    db.delete(grade.aulas[2])
    db.commit()
    db.refresh(grade)
    assert _do_tipo(db, grade, "Sem almoço") == []


def test_aula_dobrada(db):
    aulas = [
        ("P1", "6A", "Matemática", "Seg", MANHA[0]), ("P1", "6A", "Matemática", "Seg", MANHA[2]),
        ("P2", "6A", "Inglês", "Ter", MANHA[0]), ("P2", "6A", "Inglês", "Ter", MANHA[1]),
        ("P3", "6A", "Ciências", "Qua", MANHA[0]), ("P3", "6A", "Ciências", "Qua", MANHA[1]),
        ("P3", "6A", "Ciências", "Qua", MANHA[2]),
        ("P4", "6A", "Arte", "Qui", MANHA[0]), ("P4", "6A", "Arte", "Qui", MANHA[1]),
        # Horário exato fixado pela escola: fora da regra
        ("P5", "6A", "Laboratório", "Sex", MANHA[0]), ("P5", "6A", "Laboratório", "Sex", MANHA[3]),
    ]
    matriz = {"6A": [{"disciplina": "Laboratório", "aulas_semanais": 2,
                      "horarios_fixos": [{"dia_semana": "Sex", "horario": MANHA[0]}]}]}
    grade = _grade(db, aulas, matriz=matriz)

    descricoes = sorted(c["descricao"] for c in _do_tipo(db, grade, "Aula dobrada"))
    assert descricoes == [
        "6A tem 3 aulas de Ciências em Qua; o máximo é uma aula dobrada (2 seguidas).",
        "As 2 aulas de Matemática em Seg na 6A não são seguidas.",
        "Inglês é sempre aula individual, mas 6A tem 2 aulas em Ter.",
    ]


def test_primeira_e_ultima_aula_do_turno(db):
    grade = _grade(db, _manha_completa("6A", professores={0: "Ana", 5: "Ana"}))

    [c] = _do_tipo(db, grade, "Primeira e última aula")
    assert c["descricao"] == "Ana dá a primeira e a última aula da manhã em Seg (6A e 6A)."
    assert c["aula_id"] == grade.aulas[5].id
    assert c["correcao"] is not None


def test_sem_regras_quebradas(db):
    aulas = _manha_completa("6A", professores={0: "Ana", 1: "Ana"}) + _manha_completa("7A", professores={2: "Ana"})
    grade = _grade(db, aulas)
    assert DetectorConflitos(db, grade).detectar() == []
