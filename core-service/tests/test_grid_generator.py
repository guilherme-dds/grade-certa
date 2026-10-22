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
