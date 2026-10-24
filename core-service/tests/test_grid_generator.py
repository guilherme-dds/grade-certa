import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import AulaDB, DisciplinaDB, ProfessorDB, SalaDB, TurmaDB
from services.grid_generator import GridGeneratorService
from tests.test_grid_solver import MATRIZ, PROFESSOR


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_gera_e_grava_grade_com_salas_e_planejamento(db):
    lab = SalaDB(nome="Laboratório", tipo="Laboratório", capacidade=30)
    db.add(lab)
    db.add(DisciplinaDB(nome="Ciências", quantidade_aulas=4, tipo_sala="Laboratório"))
    for p in sorted(set(PROFESSOR.values())):
        db.add(ProfessorDB(nome=p.title(), email=f"{p}@escola.com", carga_maxima_aulas=20))
    for serie in "6789":
        sala = SalaDB(nome=f"Sala {serie}", tipo="Sala comum", capacidade=35)
        db.add(sala)
        db.flush()
        grupo = "67" if serie in "67" else "89"
        matriz = [
            # nome do professor com caixa diferente do cadastro: o vínculo ignora maiúsculas
            {"disciplina": d, "aulas_semanais": q, "professor": (PROFESSOR.get((d, grupo)) or PROFESSOR[(d, None)]).upper()}
            for d, q in MATRIZ
        ]
        db.add(TurmaDB(nome=f"{serie}º Ano A", turno="Manhã", nivel_ensino="Anos Finais", sala_id=sala.id, matriz_curricular=matriz))
    db.commit()

    resultado = GridGeneratorService(db).generate("Teste")

    assert resultado["sucesso"], resultado
    aulas = db.query(AulaDB).filter(AulaDB.grade_id == resultado["grade_id"]).all()
    assert len(aulas) == 4 * sum(q for _, q in MATRIZ)
    assert all(a.professor_id is not None for a in aulas)
    assert {a.sala_nome for a in aulas if a.disciplina_nome == "Ciências"} == {"Laboratório"}
    assert all(a.sala_nome == f"Sala {a.turma_nome[0]}" for a in aulas if a.disciplina_nome != "Ciências")
    # Inglês é sempre individual
    for turma in {a.turma_id for a in aulas}:
        dias = [a.dia_semana for a in aulas if a.turma_id == turma and a.disciplina_nome == "Inglês"]
        assert len(dias) == len(set(dias))


def test_educacao_fisica_usa_a_quadra_fora_dos_horarios_bloqueados(db):
    from database.models import IndisponibilidadeSalaDB

    quadra = SalaDB(nome="Quadra", tipo="Educação física", capacidade=50)
    # Quadra ocupada toda segunda e na terça de manhã cedo
    quadra.indisponibilidades = [
        IndisponibilidadeSalaDB(dia_semana="Seg", horario_inicio="07:00", horario_fim="13:00"),
        IndisponibilidadeSalaDB(dia_semana="Ter", horario_inicio="07:20", horario_fim="09:00"),
    ]
    db.add(quadra)
    for p in sorted(set(PROFESSOR.values())):
        db.add(ProfessorDB(nome=p.title(), email=f"{p}@escola.com", carga_maxima_aulas=20))
    for serie in "6789":
        grupo = "67" if serie in "67" else "89"
        matriz = [
            {"disciplina": d, "aulas_semanais": q, "professor": PROFESSOR.get((d, grupo)) or PROFESSOR[(d, None)]}
            for d, q in MATRIZ
        ]
        db.add(TurmaDB(nome=f"{serie}º Ano A", turno="Manhã", nivel_ensino="Anos Finais", matriz_curricular=matriz))
    db.commit()

    resultado = GridGeneratorService(db).generate("Teste quadra")

    assert resultado["sucesso"], resultado
    assert resultado["avisos"] == []
    aulas = db.query(AulaDB).filter(AulaDB.grade_id == resultado["grade_id"]).all()
    ed_fisica = [a for a in aulas if a.disciplina_nome == "Educação Física"]
    assert len(ed_fisica) == 8
    assert all(a.sala_nome == "Quadra" for a in ed_fisica)
    assert all(a.sala_nome is None for a in aulas if a.disciplina_nome != "Educação Física")
    assert not any(a.dia_semana == "Seg" for a in ed_fisica)
    assert not any(a.dia_semana == "Ter" and a.horario in ("07:20 - 08:10", "08:10 - 09:00") for a in ed_fisica)
    # Uma turma por vez na quadra
    usos = [(a.dia_semana, a.horario) for a in ed_fisica]
    assert len(usos) == len(set(usos))


def test_matriz_com_varios_professores_e_formato_antigo(db):
    for p in sorted(set(PROFESSOR.values())):
        db.add(ProfessorDB(nome=p.title(), email=f"{p}@escola.com", carga_maxima_aulas=20))
    for serie in "6789":
        grupo = "67" if serie in "67" else "89"
        # Formato antigo: "professor" (string)
        matriz = [
            {"disciplina": d, "aulas_semanais": q, "professor": PROFESSOR.get((d, grupo)) or PROFESSOR[(d, None)]}
            for d, q in MATRIZ
        ]
        if serie == "6":
            # Formato novo: "professores" (lista), aula dada em conjunto
            matriz.append({"disciplina": "Atualidades", "aulas_semanais": 2, "professores": ["Fabio", "Ana"]})
        db.add(TurmaDB(nome=f"{serie}º Ano A", turno="Manhã", nivel_ensino="Anos Finais", matriz_curricular=matriz))
    db.commit()

    resultado = GridGeneratorService(db).generate("Teste co-docência")

    assert resultado["sucesso"], resultado
    aulas = db.query(AulaDB).filter(AulaDB.grade_id == resultado["grade_id"]).all()
    atualidades = [a for a in aulas if a.disciplina_nome == "Atualidades"]
    assert len(atualidades) == 2
    assert all([p["nome"] for p in a.professores] == ["Fabio", "Ana"] for a in atualidades)
    assert all(a.professor_nome == "Fabio" for a in atualidades)
