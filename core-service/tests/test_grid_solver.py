from collections import defaultdict

from services.grid_solver import (
    PLANEJAMENTOS_SEMANAIS,
    Intervalo,
    ItemInput,
    ProfessorInput,
    SalaInput,
    TurmaInput,
    inferir_area,
    inferir_aula_dobrada,
    resolver_grade,
)
from services.time_slots import DIAS_SEMANA, get_slots_for_turma

TEMPO = 20.0

# Anos Finais / manhã: 6 horários por dia
SLOTS = [s["horario"] for s in get_slots_for_turma("Manhã", "Anos Finais")]

MATRIZ = [
    ("Português", 5),
    ("Matemática", 5),
    ("Ciências", 4),
    ("História", 3),
    ("Geografia", 3),
    ("Inglês", 2),
    ("Arte", 2),
    ("Educação Física", 2),
]

# 6º/7º e 8º/9º têm professores diferentes de Português e Matemática
PROFESSOR = {
    ("Português", "67"): "ana",
    ("Português", "89"): "bia",
    ("Matemática", "67"): "carlos",
    ("Matemática", "89"): "davi",
    ("Ciências", None): "eva",
    ("História", None): "fabio",
    ("Geografia", None): "gil",
    ("Inglês", None): "hugo",
    ("Arte", None): "iris",
    ("Educação Física", None): "joao",
}


def montar_escola(sala_fixa=False, tipo_sala_ciencias=None):
    turmas = []
    for tid, serie in enumerate(["6", "7", "8", "9"], start=1):
        grupo = "67" if serie in "67" else "89"
        itens = []
        for disc, qtd in MATRIZ:
            prof = PROFESSOR.get((disc, grupo)) or PROFESSOR[(disc, None)]
            itens.append(
                ItemInput(
                    disciplina=disc,
                    aulas_semanais=qtd,
                    professor=prof,
                    area=inferir_area(disc),
                    aula_dobrada=inferir_aula_dobrada(disc),
                    tipo_sala=tipo_sala_ciencias if disc == "Ciências" else None,
                )
            )
        turmas.append(
            TurmaInput(
                id=tid,
                nome=f"{serie}º Ano A",
                turno="Manhã",
                nivel_ensino="Anos Finais",
                sala_id=100 + tid if sala_fixa else None,
                itens=itens,
            )
        )
    nomes = sorted(set(PROFESSOR.values()))
    professores = {p: ProfessorInput(chave=p, nome=p.title(), id=i) for i, p in enumerate(nomes)}
    return turmas, professores


def verificar_regras(res, turmas):
    """Confere a solução de forma independente do modelo."""
    assert res.sucesso, res.mensagem
    itens = {(t.id, i.disciplina): i for t in turmas for i in t.itens}

    por_turma_dia = defaultdict(dict)  # (turma, dia) -> {idx_slot: aula}
    por_prof_dia = defaultdict(set)  # (prof, dia) -> idx_slot com aula
    contagem = defaultdict(lambda: defaultdict(list))  # (turma, disc) -> dia -> [idx]
    for a in res.aulas:
        idx = SLOTS.index(a.horario)
        assert idx not in por_turma_dia[(a.turma_id, a.dia)], "choque de turma"
        por_turma_dia[(a.turma_id, a.dia)][idx] = a
        assert idx not in por_prof_dia[(a.professor_chave, a.dia)], "choque de professor"
        por_prof_dia[(a.professor_chave, a.dia)].add(idx)
        contagem[(a.turma_id, a.disciplina)][a.dia].append(idx)

    for chave, item in itens.items():
        dias = contagem[chave]
        assert sum(len(v) for v in dias.values()) == item.aulas_semanais
        assert all(len(v) <= 2 for v in dias.values())
        duplas = [sorted(v) for v in dias.values() if len(v) == 2]
        assert all(b == a + 1 for a, b in duplas), f"aula dobrada não consecutiva: {chave}"
        if item.aula_dobrada and item.aulas_semanais >= 2:
            assert len(duplas) == max(1, item.aulas_semanais - 5), f"dobradas erradas: {chave}"
        else:
            assert not duplas, f"{chave} deveria ser só individual"

    # Turma sem horário vago: aulas começam no 1º horário e são seguidas
    for (tid, dia), slots in por_turma_dia.items():
        assert sorted(slots) == list(range(len(slots))), f"janela na turma {tid} {dia}"

    # Primeira x última aula do turno
    for dia in DIAS_SEMANA:
        primeiros = {s[0].professor_chave for (_, d), s in por_turma_dia.items() if d == dia and 0 in s}
        ultimos = {s[max(s)].professor_chave for (_, d), s in por_turma_dia.items() if d == dia}
        assert not primeiros & ultimos, f"mesmo professor na primeira e na última aula em {dia}"

    # Planejamento: 4 por semana, fora das aulas, em dia com aula, sem janela
    plan_prof_dia = defaultdict(set)
    total_plan = defaultdict(int)
    for p in res.planejamentos:
        idx = SLOTS.index(p.horario)
        assert idx not in por_prof_dia[(p.professor_chave, p.dia)]
        plan_prof_dia[(p.professor_chave, p.dia)].add(idx)
        total_plan[p.professor_chave] += 1
    profs = {i.professor for i in itens.values()}
    assert all(total_plan[p] == PLANEJAMENTOS_SEMANAIS for p in profs), dict(total_plan)
    for (prof, dia) in plan_prof_dia:
        assert por_prof_dia[(prof, dia)], f"planejamento de {prof} em {dia} sem aula no dia"
    for prof in profs:
        for dia in DIAS_SEMANA:
            presente = sorted(por_prof_dia[(prof, dia)] | plan_prof_dia[(prof, dia)])
            if presente:
                assert presente == list(range(presente[0], presente[-1] + 1)), f"janela de {prof} em {dia}"


def test_escola_completa_respeita_todas_as_regras():
    turmas, professores = montar_escola()
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    verificar_regras(res, turmas)
    # Eva é a única de Ciências da Natureza: nunca compartilha planejamento
    assert not any(p.compartilhado for p in res.planejamentos if p.professor_chave == "eva")
    assert any(p.compartilhado for p in res.planejamentos)


def test_inferencias_por_nome():
    assert not inferir_aula_dobrada("Inglês")
    assert inferir_aula_dobrada("Matemática")
    assert inferir_area("Educação Física") == "Linguagens"
    assert inferir_area("Física") == "Ciências da Natureza"
    assert inferir_area("Geometria") == "Matemática"


def test_indisponibilidade_do_professor():
    turmas, professores = montar_escola()
    professores["eva"].indisponivel = [Intervalo(dia="Seg", horario=h) for h in SLOTS]
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    verificar_regras(res, turmas)
    assert not any(a.professor_chave == "eva" and a.dia == "Seg" for a in res.aulas)
    assert not any(p.professor_chave == "eva" and p.dia == "Seg" for p in res.planejamentos)


def test_sala_especial_indisponivel():
    turmas, professores = montar_escola(sala_fixa=True, tipo_sala_ciencias="Laboratório")
    salas = {100 + t.id: SalaInput(id=100 + t.id, nome=f"Sala {t.id}") for t in turmas}
    salas[1] = SalaInput(
        id=1,
        nome="Lab",
        tipo="Laboratório",
        indisponivel=[Intervalo(dia="Ter", horario="07:00 - 13:00")],
    )
    res = resolver_grade(turmas, professores, salas, tempo_limite_seg=TEMPO)
    verificar_regras(res, turmas)
    ciencias = [a for a in res.aulas if a.disciplina == "Ciências"]
    assert all(a.sala_id == 1 and a.dia != "Ter" for a in ciencias)
    assert all(a.sala_id == 100 + a.turma_id for a in res.aulas if a.disciplina != "Ciências")


def test_carga_maxima_excedida():
    turmas, professores = montar_escola()
    professores["eva"].carga_maxima = 10
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert not res.sucesso
    assert "carga máxima" in res.mensagem


def test_conflito_aponta_regra_responsavel():
    turmas, professores = montar_escola()
    # Eva só pode às segundas: 16 aulas de Ciências não cabem em um dia
    professores["eva"].indisponivel = [
        Intervalo(dia=d, horario=h) for d in DIAS_SEMANA if d != "Seg" for h in SLOTS
    ]
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert not res.sucesso
    assert res.status == "inviavel"
    assert "disponibilidade_professor" in res.regras_em_conflito


def test_disciplina_com_aulas_demais():
    turmas, professores = montar_escola()
    turmas[0].itens = [ItemInput(disciplina="Matemática", aulas_semanais=11, professor="carlos")]
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert not res.sucesso
    assert "no máximo 10" in res.mensagem


def test_indisponibilidade_de_outro_nivel_nao_bloqueia_e_preferencia_atrai_aulas():
    turmas, professores = montar_escola()
    # Eva só dá aula nos Anos Finais: o bloqueio marcado no Ensino Médio não a afeta
    professores["eva"].indisponivel = [Intervalo(dia="Seg", horario=h, nivel="Ensino Médio") for h in SLOTS]
    # Hugo (Inglês, sempre individual) prefere quarta-feira
    professores["hugo"].preferencial = [Intervalo(dia="Qua", horario=h) for h in SLOTS]
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    verificar_regras(res, turmas)
    assert sum(1 for a in res.aulas if a.professor_chave == "hugo" and a.dia == "Qua") == 4

    professores["eva"].indisponivel = [Intervalo(dia="Seg", horario=h, nivel="Anos Finais") for h in SLOTS]
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    verificar_regras(res, turmas)
    assert not any(a.professor_chave == "eva" and a.dia == "Seg" for a in res.aulas)
