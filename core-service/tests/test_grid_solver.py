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
    inferir_tipo_sala,
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
                    professores=[prof],
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
        for chave in a.professor_chaves:
            assert idx not in por_prof_dia[(chave, a.dia)], "choque de professor"
            por_prof_dia[(chave, a.dia)].add(idx)
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
        primeiros = {c for (_, d), s in por_turma_dia.items() if d == dia and 0 in s for c in s[0].professor_chaves}
        ultimos = {c for (_, d), s in por_turma_dia.items() if d == dia for c in s[max(s)].professor_chaves}
        assert not primeiros & ultimos, f"mesmo professor na primeira e na última aula em {dia}"

    # Planejamento: 4 por semana, fora das aulas, em dia com aula, sem janela
    plan_prof_dia = defaultdict(set)
    total_plan = defaultdict(int)
    for p in res.planejamentos:
        idx = SLOTS.index(p.horario)
        assert idx not in por_prof_dia[(p.professor_chave, p.dia)]
        plan_prof_dia[(p.professor_chave, p.dia)].add(idx)
        total_plan[p.professor_chave] += 1
    profs = {c for i in itens.values() for c in i.professores}
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


def test_nomes_da_matriz_2025():
    for nome in ("Ed. Física", "Ed Física", "Educação Física"):
        assert inferir_area(nome) == "Linguagens"
        assert inferir_tipo_sala(nome) == "Educação física"
    assert inferir_tipo_sala("Física") is None
    esperado = {
        "LP – Gramática": "Linguagens",
        "LP – Redação": "Linguagens",
        "Trigonometria": "Matemática",
        "Álgebra": "Matemática",
        "Ed. Cristã": "Ciências Humanas",
        "Projeto de Vida": "Ciências Humanas",
        "Atualidades I": "Ciências Humanas",
        "Ciências Jurídicas": "Ciências Humanas",
        "Química": "Ciências da Natureza",
        "Laboratório": "Ciências da Natureza",
        "Tecnologia": None,
        "Plano": None,  # "lp" só conta no início de palavra
    }
    assert {nome: inferir_area(nome) for nome in esperado} == esperado


def test_disciplina_sem_area_agrupa_seus_professores_no_planejamento():
    # Duas turmas com Tecnologia (sem área conhecida), cada uma com um professor
    turmas = [
        TurmaInput(i, f"{i}º Ano A", "Manhã", "Anos Finais", None, [
            ItemInput("Tecnologia", 2, [f"tec{i}"], inferir_area("Tecnologia"), True),
            ItemInput("Matemática", 2, [f"mat{i}"], "Matemática", True),
        ])
        for i in (6, 7)
    ]
    professores = {c: ProfessorInput(c, c) for c in ("tec6", "tec7", "mat6", "mat7")}
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert res.sucesso, res.mensagem
    assert any(p.compartilhado for p in res.planejamentos if p.professor_chave == "tec6")


def test_indisponibilidade_do_professor():
    turmas, professores = montar_escola()
    professores["eva"].indisponivel = [Intervalo(dia="Seg", horario=h) for h in SLOTS]
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    verificar_regras(res, turmas)
    assert not any("eva" in a.professor_chaves and a.dia == "Seg" for a in res.aulas)
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
    turmas[0].itens = [ItemInput(disciplina="Matemática", aulas_semanais=11, professores=["carlos"])]
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
    assert sum(1 for a in res.aulas if "hugo" in a.professor_chaves and a.dia == "Qua") == 4

    professores["eva"].indisponivel = [Intervalo(dia="Seg", horario=h, nivel="Anos Finais") for h in SLOTS]
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    verificar_regras(res, turmas)
    assert not any("eva" in a.professor_chaves and a.dia == "Seg" for a in res.aulas)


def test_aula_com_dois_professores_reserva_os_dois():
    turmas, professores = montar_escola()
    # Atualidades no 6º ano dada em conjunto por Fábio (História) e Ana (Português do 6º/7º)
    turmas[0].itens.append(
        ItemInput("Atualidades", 2, ["fabio", "ana"], inferir_area("Atualidades"), inferir_aula_dobrada("Atualidades"))
    )
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    verificar_regras(res, turmas)  # inclui: nenhum dos dois em outra turma no mesmo horário
    atualidades = [a for a in res.aulas if a.disciplina == "Atualidades"]
    assert len(atualidades) == 2
    assert all(a.professor_chaves == ["fabio", "ana"] for a in atualidades)


def test_aula_com_horario_fixo_e_aula_sem_professor():
    turmas, professores = montar_escola()
    fixos = [("Qua", SLOTS[4]), ("Qua", SLOTS[5])]
    # Laboratório fixo na quarta (dois últimos horários) e uma eletiva sem professor fixa na sexta
    turmas[0].itens += [
        ItemInput("Laboratório", 2, ["eva"], "Ciências da Natureza", True, horarios_fixos=fixos),
        ItemInput("Eletiva", 1, [], None, True, horarios_fixos=[("Sex", SLOTS[0])]),
    ]
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert res.sucesso, res.mensagem
    lab = sorted((a.dia, a.horario) for a in res.aulas if a.disciplina == "Laboratório")
    assert lab == sorted(fixos)
    eletiva = [a for a in res.aulas if a.disciplina == "Eletiva"]
    assert [(a.dia, a.horario, a.professor_chaves) for a in eletiva] == [("Sex", SLOTS[0], [])]
    assert any("Eletiva" in aviso and "sem professor" in aviso for aviso in res.avisos)
    # Eva não tem outra aula no horário do laboratório
    assert not any(
        "eva" in a.professor_chaves and a.disciplina != "Laboratório" and (a.dia, a.horario) in fixos
        for a in res.aulas
    )


def test_horario_fixo_fora_da_grade_da_turma():
    turmas, professores = montar_escola()
    turmas[0].itens.append(ItemInput("Laboratório", 2, ["eva"], None, True, horarios_fixos=[("Qua", "13:50 - 14:40")]))
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert not res.sucesso
    assert "não é um horário de aula da turma" in res.mensagem


def test_horarios_fixos_conflitantes_aponta_a_regra():
    turmas, professores = montar_escola()
    # Eva fixa em duas turmas no mesmo horário: impossível
    for t in turmas[:2]:
        t.itens.append(ItemInput("Laboratório", 1, ["eva"], None, True, horarios_fixos=[("Qua", SLOTS[5])]))
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert not res.sucesso
    assert "horarios_fixos" in res.regras_em_conflito


# 1º EM 2025: 34 aulas = 30 da manhã + 4 numa tarde
MATRIZ_1EM = [
    ("LP – Gramática", 2), ("LP – Literatura", 2), ("LP – Redação", 2), ("Inglês", 1), ("Arte", 1),
    ("Ed. Física", 2), ("Biologia", 2), ("Física", 2), ("Química", 2), ("Álgebra", 2), ("Trigonometria", 2),
    ("Geometria", 2), ("História", 2), ("Geografia", 2), ("Filosofia", 1), ("Sociologia", 1),
    ("Ciências Jurídicas", 2), ("Tecnologia", 2), ("Projeto de Vida", 1), ("Ed. Cristã", 1),
]
TARDE_EM = [s["horario"] for s in get_slots_for_turma("Manhã + tardes", "Ensino Médio") if s["turno"] == "tarde"]


def montar_1em(tardes=(), extras=()):
    itens = [
        ItemInput(d, q, [f"p{i}"], inferir_area(d), inferir_aula_dobrada(d))
        for i, (d, q) in enumerate(MATRIZ_1EM)
    ] + list(extras)
    turma = TurmaInput(1, "1º EM A", "Manhã + tardes", "Ensino Médio", None, itens, tardes=list(tardes))
    chaves = {c for i in itens for c in i.professores}
    return [turma], {c: ProfessorInput(c, c) for c in chaves}


def tardes_da_solucao(res):
    return {a.dia for a in res.aulas if a.horario in TARDE_EM}


def test_manha_e_tardes_automatico_usa_uma_tarde_fechada():
    assert sum(q for _, q in MATRIZ_1EM) == 34
    turmas, professores = montar_1em()
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert res.sucesso, res.mensagem
    assert len(res.aulas) == 34
    (dia,) = tardes_da_solucao(res)
    assert sorted(a.horario for a in res.aulas if a.dia == dia and a.horario in TARDE_EM) == TARDE_EM


def test_manha_e_tardes_com_dia_escolhido_e_laboratorio_fixo():
    # Laboratório extra fixo na quarta 13h50–15h30: a quarta precisa ter aula à tarde
    lab = ItemInput("Laboratório", 2, ["bio", "fis", "qui"], None, True,
                    horarios_fixos=[("Qua", TARDE_EM[0]), ("Qua", TARDE_EM[1])])
    turmas, professores = montar_1em(tardes=["Qua", "Sex"], extras=[lab])
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert res.sucesso, res.mensagem
    assert tardes_da_solucao(res) <= {"Qua", "Sex"}
    assert sorted(a.horario for a in res.aulas if a.disciplina == "Laboratório") == TARDE_EM[:2]


def test_manha_e_tardes_sem_espaco_nas_tardes_escolhidas():
    extra = ItemInput("Atualidades", 4, ["p99"], None, True)
    turmas, professores = montar_1em(tardes=["Qua"], extras=[extra])  # 38 aulas, 34 horários
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert not res.sucesso
    assert "disponibiliza apenas 34 horários" in res.mensagem


def test_tarde_fixa_fora_dos_dias_escolhidos():
    lab = ItemInput("Laboratório", 1, ["bio"], None, True, horarios_fixos=[("Seg", TARDE_EM[0])])
    turmas, professores = montar_1em(tardes=["Qua", "Sex"], extras=[lab])
    res = resolver_grade(turmas, professores, {}, tempo_limite_seg=TEMPO)
    assert not res.sucesso
    assert "não é um horário de aula da turma" in res.mensagem
