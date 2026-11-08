from database.models import AulaDB, GradeDB, ProfessorDB, TurmaDB
from tests.test_api import ctx  # noqa: F401 (fixture)

S = ["07:20 - 08:10", "08:10 - 09:00", "09:00 - 09:50", "10:10 - 11:00", "11:00 - 11:50", "11:50 - 12:40"]


def _grade(db, aulas, planejamentos):
    """Ana (Matemática) e Bia (Matemática) no 6º Ano A; `aulas` e `planejamentos` são (prof, dia, slot)."""
    ana = ProfessorDB(nome="Ana", email="ana@x.com")
    bia = ProfessorDB(nome="Bia", email="bia@x.com")
    turma = TurmaDB(nome="6º Ano A", turno="Manhã", nivel_ensino="Anos Finais")
    db.add_all([ana, bia, turma])
    db.flush()
    profs = {"ana": ana, "bia": bia}
    grade = GradeDB(nome="G", status="sucesso", total_aulas=len(aulas), detalhes={
        "planejamentos": [
            {"professor": profs[p].nome, "professor_id": profs[p].id, "dia_semana": d, "horario": S[s], "compartilhado": False}
            for p, d, s in planejamentos
        ],
        "janelas": [],
    })
    grade.aulas = [
        AulaDB(turma_id=turma.id, turma_nome=turma.nome, disciplina_nome="Matemática", professor_id=profs[p].id,
               professor_nome=profs[p].nome, professores=[{"id": profs[p].id, "nome": profs[p].nome}],
               dia_semana=d, horario=S[s], ordem=s + 1)
        for p, d, s in aulas
    ]
    db.add(grade)
    db.commit()
    return grade, ana, bia


def _editar(client, aula, dia, horario):
    r = client.put(f"/grades/aulas/{aula.id}", json={
        "dia_semana": dia, "horario": horario, "professor_ids": [p["id"] for p in aula.professores],
    })
    assert r.status_code == 200, r.text
    return client.get("/grades/historico").json()[0]["detalhes"]


def test_planejamento_sob_a_aula_movida_vai_para_a_janela_criada(ctx):
    client, db = ctx
    grade, ana, _ = _grade(
        db,
        aulas=[("ana", "Seg", 0), ("ana", "Seg", 1), ("ana", "Seg", 3), ("ana", "Ter", 0), ("ana", "Qua", 0), ("ana", "Qui", 0)],
        planejamentos=[("ana", "Seg", 2), ("ana", "Ter", 1), ("ana", "Qua", 1), ("ana", "Qui", 1)],
    )
    # A aula das 08:10 vai para as 09:00, onde estava o planejamento, e deixa as 08:10 vagas
    detalhes = _editar(client, grade.aulas[1], "Seg", S[2])

    planos = {(p["dia_semana"], p["horario"]) for p in detalhes["planejamentos"]}
    assert planos == {("Seg", S[1]), ("Ter", S[1]), ("Qua", S[1]), ("Qui", S[1])}
    assert detalhes["janelas"] == []


def test_dia_sem_aula_perde_o_planejamento_e_ele_tapa_janelas(ctx):
    client, db = ctx
    grade, ana, _ = _grade(
        db,
        aulas=[("ana", "Seg", 0), ("ana", "Seg", 5), ("ana", "Ter", 0)],
        planejamentos=[("ana", "Ter", 1)],
    )
    # Ana passa a ter aula só na segunda (07:20, 08:10 e 11:50): o planejamento de terça sai
    # e os vagos entre as aulas viram planejamento; não sobra horário para o 4º
    detalhes = _editar(client, grade.aulas[2], "Seg", S[1])

    planos = [(p["dia_semana"], p["horario"]) for p in detalhes["planejamentos"]]
    assert planos == [("Seg", S[2]), ("Seg", S[3]), ("Seg", S[4])]
    assert detalhes["janelas"] == []


def test_janela_que_sobra_aparece(ctx):
    client, db = ctx
    grade, ana, _ = _grade(
        db,
        aulas=[("ana", d, 0) for d in ("Seg", "Ter", "Qua", "Qui")] + [("ana", "Sex", 0), ("ana", "Sex", 2)],
        planejamentos=[("ana", d, 1) for d in ("Seg", "Ter", "Qua", "Qui")],
    )
    # Na sexta, 07:20 e 11:50 com os 4 planejamentos já usados: 08:10 a 11:50 ficam vagos
    detalhes = _editar(client, grade.aulas[5], "Sex", S[5])
    assert [(j["dia_semana"], j["horario"]) for j in detalhes["janelas"]] == [("Sex", h) for h in S[1:5]]


def test_planejamento_compartilhado_e_recalculado(ctx):
    client, db = ctx
    grade, ana, bia = _grade(
        db,
        aulas=[("ana", "Seg", 0), ("bia", "Seg", 1), ("bia", "Ter", 0)],
        planejamentos=[("ana", "Seg", 2), ("bia", "Seg", 2)],
    )
    detalhes = _editar(client, grade.aulas[2], "Ter", S[1])
    seg = [p for p in detalhes["planejamentos"] if p["dia_semana"] == "Seg" and p["horario"] == S[2]]
    assert {p["professor"] for p in seg} == {"Ana", "Bia"}
    assert all(p["compartilhado"] for p in seg)


def test_almoco_entre_turnos_nao_conta_como_janela(ctx):
    client, db = ctx
    grade, ana, _ = _grade(
        db,
        aulas=[("ana", "Seg", 5)] + [("ana", d, 0) for d in ("Ter", "Qua", "Qui", "Sex")],
        planejamentos=[("ana", d, 1) for d in ("Ter", "Qua", "Qui", "Sex")],
    )
    tarde = TurmaDB(nome="7º Ano B", turno="Tarde", nivel_ensino="Anos Finais")
    db.add(tarde)
    db.flush()
    aula = AulaDB(grade_id=grade.id, turma_id=tarde.id, turma_nome=tarde.nome, disciplina_nome="Matemática",
                  professor_id=ana.id, professor_nome="Ana", professores=[{"id": ana.id, "nome": "Ana"}],
                  dia_semana="Seg", horario="13:00 - 13:50", ordem=1)
    db.add(aula)
    db.commit()

    # Aula às 11:50 e às 13:50: o horário das 13:00 é o almoço de 40 min (entre 11:30 e 14:30)
    detalhes = _editar(client, aula, "Seg", "13:50 - 14:40")
    assert detalhes["janelas"] == []
    assert {p["dia_semana"] for p in detalhes["planejamentos"]} == {"Ter", "Qua", "Qui", "Sex"}
