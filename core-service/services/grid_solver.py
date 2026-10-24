"""
Modelo CP-SAT da grade horária, independente do banco de dados.

Recebe turmas, professores e salas já carregados (dataclasses abaixo) e devolve as
aulas e os horários de planejamento alocados. Fica separado do GridGeneratorService
para poder ser testado sem MySQL.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from ortools.sat.python import cp_model

from services.time_slots import (
    DIAS_SEMANA,
    get_slots_for_turma,
    infer_nivel_ensino,
    slots_overlap,
    tem_tardes_parciais,
)

PLANEJAMENTOS_SEMANAIS = 4

# Regras que podem ser apontadas como causa de inviabilidade (via assumptions do CP-SAT).
# As regras básicas (quantidade de aulas, choque de turma e de professor) são sempre aplicadas.
REGRAS = {
    "disponibilidade_professor": "horários indisponíveis dos professores",
    "salas": "ocupação e horários indisponíveis das salas",
    "aulas_dobradas": "uma aula dobrada por disciplina e o restante individual",
    "sem_janela_turma": "turma sem horário vago entre aulas",
    "sem_janela_professor": "professor sem janela entre aulas",
    "primeira_ultima": "quem dá a primeira aula do turno não dá a última",
    "planejamento": f"{PLANEJAMENTOS_SEMANAIS} horários de planejamento por professor",
    "horarios_fixos": "aulas com dia e horário fixos",
}

# Início de palavra (sem acento) que indica a área do conhecimento pelo nome da disciplina.
# A ordem importa: Humanas vem antes de Natureza por causa de "Ciências Jurídicas".
AREAS_POR_PALAVRA = [
    ("Matemática", ["matematica", "geometria", "algebra", "trigonometria", "aritmetica", "estatistica"]),
    ("Linguagens", ["portugues", "lingua", "lp", "gramatica", "literatura", "redacao", "ingles", "espanhol", "arte"]),
    ("Ciências Humanas", [
        "historia", "geografia", "filosofia", "sociologia", "religi", "crista", "projeto de vida",
        "atualidades", "juridic", "humanas",
    ]),
    ("Ciências da Natureza", ["ciencias", "biologia", "fisica", "quimica", "natureza", "laboratorio"]),
]

# "Educação Física", "Ed. Física", "Ed Física"
_EDUCACAO_FISICA = re.compile(r"\bed(ucacao)?\.?\s*fisica\b")


def normalizar(texto: Optional[str]) -> str:
    """Minúsculas e sem acentos, para comparar nomes digitados de formas diferentes."""
    sem_acento = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def _eh_educacao_fisica(nome: str) -> bool:
    return bool(_EDUCACAO_FISICA.search(normalizar(nome)))


def inferir_area(disciplina: str) -> Optional[str]:
    nome = normalizar(disciplina)
    # Educação Física precisa vencer "fisica" (Ciências da Natureza)
    if _eh_educacao_fisica(nome):
        return "Linguagens"
    for area, palavras in AREAS_POR_PALAVRA:
        if any(re.search(rf"\b{p}", nome) for p in palavras):
            return area
    return None


def inferir_tipo_sala(disciplina: str) -> Optional[str]:
    """Educação Física usa a quadra (tipo "Educação física"); as demais não exigem sala."""
    return "Educação física" if _eh_educacao_fisica(disciplina) else None


def inferir_aula_dobrada(disciplina: str) -> bool:
    """Por padrão toda disciplina tem aula dobrada, exceto Inglês (sempre individual)."""
    return "ingles" not in normalizar(disciplina)


@dataclass
class Intervalo:
    dia: str
    horario: str  # "HH:MM - HH:MM"
    # Nível de ensino em que o horário foi marcado; nulo = vale para qualquer nível
    nivel: Optional[str] = None

    def aplica(self, dia: str, horario: str, nivel: Optional[str] = None) -> bool:
        if self.dia != dia or not slots_overlap(self.horario, horario):
            return False
        return self.nivel is None or nivel is None or normalizar(self.nivel) == normalizar(nivel)


@dataclass
class ItemInput:
    disciplina: str
    aulas_semanais: int
    # Chaves normalizadas dos professores; mais de um = aula dada em conjunto (ou rodízio),
    # e todos ficam reservados naquele horário
    professores: List[str] = field(default_factory=list)
    area: Optional[str] = None
    aula_dobrada: bool = True
    tipo_sala: Optional[str] = None
    # (dia, horário) em que a aula precisa acontecer, definidos pela escola (ex.: laboratório
    # na quarta à tarde). As aulas restantes, se houver, o gerador distribui.
    horarios_fixos: List[Tuple[str, str]] = field(default_factory=list)


@dataclass
class TurmaInput:
    id: int
    nome: str
    turno: str
    nivel_ensino: Optional[str] = None
    sala_id: Optional[int] = None
    itens: List[ItemInput] = field(default_factory=list)
    # Turno "Manhã + tardes": dias com aula à tarde; vazio = o gerador escolhe (usando o mínimo de tardes)
    tardes: List[str] = field(default_factory=list)

    def dias_com_tarde(self) -> List[str]:
        if not tem_tardes_parciais(self.turno):
            return list(DIAS_SEMANA)
        return [d for d in DIAS_SEMANA if d in self.tardes] if self.tardes else list(DIAS_SEMANA)


@dataclass
class ProfessorInput:
    chave: str
    nome: str
    id: Optional[int] = None
    carga_maxima: Optional[int] = None
    indisponivel: List[Intervalo] = field(default_factory=list)
    preferencial: List[Intervalo] = field(default_factory=list)


@dataclass
class SalaInput:
    id: int
    nome: str
    tipo: str = "Sala comum"
    indisponivel: List[Intervalo] = field(default_factory=list)


@dataclass
class AulaAlocada:
    turma_id: int
    turma_nome: str
    disciplina: str
    professor_chaves: List[str]
    sala_id: Optional[int]
    dia: str
    horario: str
    ordem: int


@dataclass
class PlanejamentoAlocado:
    professor_chave: str
    dia: str
    horario: str
    compartilhado: bool


@dataclass
class SolverResult:
    sucesso: bool
    status: str
    mensagem: str
    aulas: List[AulaAlocada] = field(default_factory=list)
    planejamentos: List[PlanejamentoAlocado] = field(default_factory=list)
    avisos: List[str] = field(default_factory=list)
    regras_em_conflito: List[str] = field(default_factory=list)
    solver_status: Optional[str] = None
    tempo_seg: float = 0.0


def _inviavel(mensagem: str, avisos: List[str]) -> SolverResult:
    return SolverResult(sucesso=False, status="inviavel", mensagem=mensagem, avisos=avisos)


def _qtd_duplas(item: ItemInput) -> int:
    """Uma aula dobrada por semana; só usa mais se não couber uma aula individual por dia."""
    if not item.aula_dobrada or item.aulas_semanais < 2:
        return 0
    return max(1, item.aulas_semanais - len(DIAS_SEMANA))


def _sem_sobreposicao(model, alocacoes: List[Tuple[cp_model.IntVar, str]], lit=None) -> None:
    """No máximo uma das variáveis pode valer 1 entre horários que se sobrepõem no tempo."""
    for i in range(len(alocacoes)):
        var_i, h_i = alocacoes[i]
        for j in range(i + 1, len(alocacoes)):
            var_j, h_j = alocacoes[j]
            if slots_overlap(h_i, h_j):
                ct = model.Add(var_i + var_j <= 1)
                if lit is not None:
                    ct.OnlyEnforceIf(lit)


def resolver_grade(
    turmas: List[TurmaInput],
    professores: Dict[str, ProfessorInput],
    salas: Dict[int, SalaInput],
    tempo_limite_seg: float = 45.0,
    workers: int = 8,
    regras_desligadas: Tuple[str, ...] = (),
) -> SolverResult:
    avisos: List[str] = []
    turmas = [t for t in turmas if any(i.aulas_semanais > 0 for i in t.itens)]
    if not turmas:
        return SolverResult(
            sucesso=False,
            status="sem_dados",
            mensagem="Nenhuma turma possui matriz curricular com aulas semanais cadastradas.",
        )

    # ------------------------------------------------------------------
    # 1. Pré-validações baratas, com mensagens específicas
    # ------------------------------------------------------------------
    turma_slots: Dict[int, List[dict]] = {}
    aulas_por_prof: Dict[str, int] = {}
    for t in turmas:
        t.itens = [i for i in t.itens if i.aulas_semanais > 0]
        slots = get_slots_for_turma(turno=t.turno, nivel_ensino=t.nivel_ensino, turma_nome=t.nome)
        turma_slots[t.id] = slots
        capacidade = sum(
            1 for dia in DIAS_SEMANA for s in slots if s["turno"] != "tarde" or dia in t.dias_com_tarde()
        )
        total = sum(i.aulas_semanais for i in t.itens)
        if total > capacidade:
            return _inviavel(
                f"Inviável: a turma '{t.nome}' necessita de {total} aulas semanais, mas o nível "
                f"'{infer_nivel_ensino(t.nome, t.nivel_ensino)}' no turno '{t.turno}' disponibiliza "
                f"apenas {capacidade} horários na semana.",
                avisos,
            )
        horarios_turma = {s["horario"] for s in slots}
        for item in t.itens:
            if len(set(item.horarios_fixos)) > item.aulas_semanais:
                return _inviavel(
                    f"Inviável: '{item.disciplina}' na turma '{t.nome}' tem mais horários fixos que aulas semanais.",
                    avisos,
                )
            for dia, horario in item.horarios_fixos:
                tarde_bloqueada = any(
                    s["horario"] == horario and s["turno"] == "tarde" for s in slots
                ) and dia not in t.dias_com_tarde()
                if dia not in DIAS_SEMANA or horario not in horarios_turma or tarde_bloqueada:
                    return _inviavel(
                        f"Inviável: '{item.disciplina}' na turma '{t.nome}' está fixa em {dia}, {horario}, "
                        f"que não é um horário de aula da turma no turno '{t.turno}'.",
                        avisos,
                    )
            max_semana = len(DIAS_SEMANA) * (2 if item.aula_dobrada else 1)
            if item.aulas_semanais > max_semana:
                regra = "no máximo 2 por dia" if item.aula_dobrada else "aulas individuais, 1 por dia"
                return _inviavel(
                    f"Inviável: '{item.disciplina}' na turma '{t.nome}' tem {item.aulas_semanais} aulas "
                    f"semanais, mas a regra ({regra}) permite no máximo {max_semana}.",
                    avisos,
                )
            for chave in item.professores:
                aulas_por_prof[chave] = aulas_por_prof.get(chave, 0) + item.aulas_semanais
            if not item.professores:
                avisos.append(f"'{item.disciplina}' na turma '{t.nome}' está sem professor.")

    for chave, total in aulas_por_prof.items():
        prof = professores[chave]
        if prof.carga_maxima is not None and total > prof.carga_maxima:
            return _inviavel(
                f"Inviável: o professor '{prof.nome}' recebeu {total} aulas na matriz curricular, "
                f"acima da carga máxima de {prof.carga_maxima}.",
                avisos,
            )

    salas_por_tipo: Dict[str, List[int]] = {}
    for sala in salas.values():
        salas_por_tipo.setdefault(normalizar(sala.tipo), []).append(sala.id)

    model = cp_model.CpModel()
    lits = {nome: model.NewBoolVar(f"regra_{nome}") for nome in REGRAS}

    # ------------------------------------------------------------------
    # 2. Variáveis de aula: x[(turma, item, dia, ordem)]
    # ------------------------------------------------------------------
    x: Dict[Tuple[int, int, str, int], cp_model.IntVar] = {}
    # (turma, item, dia, ordem) -> [(sala_id, var)] para extrair a sala escolhida
    escolha_sala: Dict[Tuple[int, int, str, int], List[Tuple[int, cp_model.IntVar]]] = {}
    # professor -> dia -> [(var, horario)]
    prof_aulas: Dict[str, Dict[str, List[Tuple[cp_model.IntVar, str]]]] = {}
    # professor -> [(var, dia, horario, nivel)] para disponibilidade marcada por nível
    prof_aulas_nivel: Dict[str, List[Tuple[cp_model.IntVar, str, str, str]]] = {}
    # sala -> dia -> [(var, horario)]
    sala_uso: Dict[int, Dict[str, List[Tuple[cp_model.IntVar, str]]]] = {}

    for t in turmas:
        sala_fixa = t.sala_id if t.sala_id in salas else None
        if t.sala_id is not None and sala_fixa is None:
            avisos.append(f"A sala fixa da turma '{t.nome}' não existe mais; aulas sem sala.")
        for idx, item in enumerate(t.itens):
            candidatas: List[int] = []
            if item.tipo_sala:
                candidatas = salas_por_tipo.get(normalizar(item.tipo_sala), [])
                if not candidatas:
                    avisos.append(
                        f"Não há sala do tipo '{item.tipo_sala}' para '{item.disciplina}' "
                        f"da turma '{t.nome}'; a aula fica sem sala."
                    )
            if not candidatas and sala_fixa is not None:
                candidatas = [sala_fixa]

            for dia in DIAS_SEMANA:
                for slot in turma_slots[t.id]:
                    ordem, horario = slot["ordem"], slot["horario"]
                    var = model.NewBoolVar(f"x_t{t.id}_i{idx}_{dia}_s{ordem}")
                    x[(t.id, idx, dia, ordem)] = var
                    for chave in item.professores:
                        prof_aulas.setdefault(chave, {}).setdefault(dia, []).append((var, horario))
                        prof_aulas_nivel.setdefault(chave, []).append((var, dia, horario, slot["nivel"]))

                    if len(candidatas) == 1:
                        opcoes = [(candidatas[0], var)]
                    else:
                        opcoes = [
                            (sid, model.NewBoolVar(f"sala{sid}_t{t.id}_i{idx}_{dia}_s{ordem}"))
                            for sid in candidatas
                        ]
                        if opcoes:
                            model.Add(sum(v for _, v in opcoes) == var)
                    escolha_sala[(t.id, idx, dia, ordem)] = opcoes
                    for sid, v in opcoes:
                        sala_uso.setdefault(sid, {}).setdefault(dia, []).append((v, horario))

    # ------------------------------------------------------------------
    # 3. Regras básicas (sempre aplicadas)
    # ------------------------------------------------------------------
    # occ[(turma, dia, ordem)] = turma tem aula naquele horário
    occ: Dict[Tuple[int, str, int], cp_model.IntVar] = {}
    for t in turmas:
        slots = turma_slots[t.id]
        for idx, item in enumerate(t.itens):
            model.Add(sum(x[(t.id, idx, d, s["ordem"])] for d in DIAS_SEMANA for s in slots) == item.aulas_semanais)
        for dia in DIAS_SEMANA:
            for s in slots:
                o = model.NewBoolVar(f"occ_t{t.id}_{dia}_s{s['ordem']}")
                model.Add(sum(x[(t.id, idx, dia, s["ordem"])] for idx in range(len(t.itens))) == o)
                occ[(t.id, dia, s["ordem"])] = o

    for por_dia in prof_aulas.values():
        for alocacoes in por_dia.values():
            _sem_sobreposicao(model, alocacoes)

    # Turno "Manhã + tardes": só há aula à tarde nos dias escolhidos; sem escolha, o
    # gerador decide e tenta usar o mínimo de tardes (uma "tarde fechada")
    tardes_usadas: List[cp_model.IntVar] = []
    for t in turmas:
        if not tem_tardes_parciais(t.turno):
            continue
        tarde = [s["ordem"] for s in turma_slots[t.id] if s["turno"] == "tarde"]
        for dia in DIAS_SEMANA:
            ocupacao = [occ[(t.id, dia, o)] for o in tarde]
            if dia not in t.dias_com_tarde():
                for o in ocupacao:
                    model.Add(o == 0)
            elif not t.tardes:
                usa = model.NewBoolVar(f"tarde_t{t.id}_{dia}")
                model.AddMaxEquality(usa, ocupacao)
                tardes_usadas.append(usa)

    # Aulas com dia e horário definidos pela escola
    for t in turmas:
        ordem_por_horario = {s["horario"]: s["ordem"] for s in turma_slots[t.id]}
        for idx, item in enumerate(t.itens):
            for dia, horario in set(item.horarios_fixos):
                model.Add(x[(t.id, idx, dia, ordem_por_horario[horario])] == 1).OnlyEnforceIf(lits["horarios_fixos"])

    # ------------------------------------------------------------------
    # 4. Regras com literal (identificáveis em caso de inviabilidade)
    # ------------------------------------------------------------------
    # Indisponibilidade dos professores
    for chave, prof in professores.items():
        for var, dia, horario, nivel in prof_aulas_nivel.get(chave, []):
            if any(ind.aplica(dia, horario, nivel) for ind in prof.indisponivel):
                model.Add(var == 0).OnlyEnforceIf(lits["disponibilidade_professor"])

    # Salas: uma turma por vez e respeito aos horários ocupados por outras atividades
    for sid, por_dia in sala_uso.items():
        for dia, alocacoes in por_dia.items():
            _sem_sobreposicao(model, alocacoes, lits["salas"])
            for ind in salas[sid].indisponivel:
                if ind.dia != dia:
                    continue
                for var, horario in alocacoes:
                    if slots_overlap(horario, ind.horario):
                        model.Add(var == 0).OnlyEnforceIf(lits["salas"])

    for t in turmas:
        slots = turma_slots[t.id]

        # Aula dobrada: cada dia tem no máximo um bloco da disciplina, que é uma aula
        # individual ou uma dupla em horários vizinhos do mesmo turno; n blocos duplos na semana
        for idx, item in enumerate(t.itens):
            # Quem fixou o horário já decidiu a distribuição da disciplina
            if item.horarios_fixos:
                continue
            duplas = _qtd_duplas(item)
            blocos_duplos = []
            for dia in DIAS_SEMANA:
                vars_dia = [x[(t.id, idx, dia, s["ordem"])] for s in slots]
                if not duplas:
                    model.Add(sum(vars_dia) <= 1).OnlyEnforceIf(lits["aulas_dobradas"])
                    continue
                # dupla[p] = bloco duplo começando em slots[p]
                dupla = [
                    model.NewBoolVar(f"dupla_t{t.id}_i{idx}_{dia}_s{s['ordem']}")
                    if p + 1 < len(slots) and slots[p + 1]["turno"] == s["turno"]
                    else None
                    for p, s in enumerate(slots)
                ]
                simples = [model.NewBoolVar(f"simples_t{t.id}_i{idx}_{dia}_s{s['ordem']}") for s in slots]
                for p in range(len(slots)):
                    cobre = [simples[p]] + [d for d in (dupla[p], dupla[p - 1] if p else None) if d is not None]
                    model.Add(vars_dia[p] == sum(cobre)).OnlyEnforceIf(lits["aulas_dobradas"])
                duplas_dia = [d for d in dupla if d is not None]
                model.Add(sum(simples) + sum(duplas_dia) <= 1).OnlyEnforceIf(lits["aulas_dobradas"])
                blocos_duplos.extend(duplas_dia)
            if duplas:
                model.Add(sum(blocos_duplos) == duplas).OnlyEnforceIf(lits["aulas_dobradas"])

        # Turma sem horário vago: as aulas de cada turno começam no 1º horário e são seguidas
        for dia in DIAS_SEMANA:
            for a, b in zip(slots, slots[1:]):
                if a["turno"] == b["turno"]:
                    model.Add(occ[(t.id, dia, b["ordem"])] <= occ[(t.id, dia, a["ordem"])]).OnlyEnforceIf(
                        lits["sem_janela_turma"]
                    )

    # Quem dá a primeira aula de um turno não dá a última aula desse turno no mesmo dia
    ultima: Dict[Tuple[str, str, str], cp_model.IntVar] = {}

    def _flag(store, chave, dia, turno, nome):
        k = (chave, dia, turno)
        if k not in store:
            store[k] = model.NewBoolVar(f"{nome}_{chave}_{dia}_{turno}")
        return store[k]

    aulas_primeiro: Dict[Tuple[str, str, str], List[cp_model.IntVar]] = {}
    for t in turmas:
        slots = turma_slots[t.id]
        for idx, item in enumerate(t.itens):
            for chave, dia, (pos, s) in (
                (c, d, ps) for c in item.professores for d in DIAS_SEMANA for ps in enumerate(slots)
            ):
                var = x[(t.id, idx, dia, s["ordem"])]
                turno = s["turno"]
                eh_primeiro = pos == 0 or slots[pos - 1]["turno"] != turno
                prox = slots[pos + 1] if pos + 1 < len(slots) and slots[pos + 1]["turno"] == turno else None
                if eh_primeiro:
                    aulas_primeiro.setdefault((chave, dia, turno), []).append(var)
                ult = _flag(ultima, chave, dia, turno, "ult")
                if prox is None:
                    model.AddImplication(var, ult)
                else:
                    # é a última aula da turma se o horário seguinte estiver vago
                    model.AddBoolOr([var.Not(), occ[(t.id, dia, prox["ordem"])], ult])
    for k, vars_primeiro in aulas_primeiro.items():
        # sem choque de professor, ele dá no máximo uma primeira aula por turno: soma == "deu a primeira"
        model.Add(sum(vars_primeiro) + _flag(ultima, *k, "ult") <= 1).OnlyEnforceIf(lits["primeira_ultima"])

    # ------------------------------------------------------------------
    # 5. Planejamento e janelas do professor
    # ------------------------------------------------------------------
    # Linha do tempo de cada professor por turno: horários distintos das turmas em que leciona
    linha_tempo: Dict[str, Dict[str, List[str]]] = {}
    # Áreas de cada professor pelas disciplinas que leciona; disciplina sem área conhecida
    # ("Tecnologia") vira um grupo próprio com os demais professores dela
    areas_prof: Dict[str, set] = {}
    for t in turmas:
        for item, chave in ((i, c) for i in t.itens for c in i.professores):
            areas_prof.setdefault(chave, set()).add(item.area or normalizar(item.disciplina))
            por_turno = linha_tempo.setdefault(chave, {})
            for s in turma_slots[t.id]:
                lista = por_turno.setdefault(s["turno"], [])
                if s["horario"] not in lista:
                    lista.append(s["horario"])
    for por_turno in linha_tempo.values():
        for lista in por_turno.values():
            lista.sort()

    # plan[(prof, dia, turno, horario)]
    plan: Dict[Tuple[str, str, str, str], cp_model.IntVar] = {}
    for chave, por_turno in linha_tempo.items():
        indisponivel = professores[chave].indisponivel
        plans_semana = []
        for dia in DIAS_SEMANA:
            aulas_dia = prof_aulas.get(chave, {}).get(dia, [])
            for turno, horarios in por_turno.items():
                pres = []
                for h in horarios:
                    p = model.NewBoolVar(f"plan_{chave}_{dia}_{h}")
                    plan[(chave, dia, turno, h)] = p
                    plans_semana.append(p)

                    ocupado_vars = [v for v, hv in aulas_dia if slots_overlap(h, hv)]
                    ocupado = model.NewBoolVar(f"ocupado_{chave}_{dia}_{h}")
                    if ocupado_vars:
                        model.AddMaxEquality(ocupado, ocupado_vars)
                    else:
                        model.Add(ocupado == 0)
                    model.Add(p + ocupado <= 1)

                    presente = model.NewBoolVar(f"presente_{chave}_{dia}_{h}")
                    model.Add(presente == p + ocupado)
                    pres.append(presente)

                    # o planejamento não tem nível: qualquer horário indisponível que se sobreponha bloqueia
                    if any(ind.aplica(dia, h) for ind in indisponivel):
                        model.Add(p == 0).OnlyEnforceIf(lits["disponibilidade_professor"])

                # Horários de níveis diferentes podem se sobrepor: um planejamento por vez
                for a in range(len(horarios)):
                    for b in range(a + 1, len(horarios)):
                        if slots_overlap(horarios[a], horarios[b]):
                            model.Add(plan[(chave, dia, turno, horarios[a])] + plan[(chave, dia, turno, horarios[b])] <= 1)

                # Planejamento só em dia em que o professor tem aula (em qualquer turno: quem só
                # dá aula à tarde naquele dia pode planejar de manhã)
                da_aula = model.NewBoolVar(f"da_aula_{chave}_{dia}_{turno}")
                if aulas_dia:
                    model.AddMaxEquality(da_aula, [v for v, _ in aulas_dia])
                else:
                    model.Add(da_aula == 0)
                for h in horarios:
                    model.Add(plan[(chave, dia, turno, h)] <= da_aula).OnlyEnforceIf(lits["planejamento"])

                # Sem janela: entre dois horários com presença, todo horário intermediário
                # (ou algum que se sobreponha a ele) precisa ter aula ou planejamento
                cobertura = []
                for j, hj in enumerate(horarios):
                    sobrepostos = [pres[k] for k, hk in enumerate(horarios) if slots_overlap(hj, hk)]
                    if len(sobrepostos) == 1:
                        cobertura.append(sobrepostos[0])
                    else:
                        c = model.NewBoolVar(f"cobre_{chave}_{dia}_{hj}")
                        model.AddMaxEquality(c, sobrepostos)
                        cobertura.append(c)
                n = len(horarios)
                for i in range(n):
                    for k in range(i + 2, n):
                        for j in range(i + 1, k):
                            if slots_overlap(horarios[i], horarios[j]) or slots_overlap(horarios[j], horarios[k]):
                                continue
                            model.Add(pres[i] + pres[k] - cobertura[j] <= 1).OnlyEnforceIf(
                                lits["sem_janela_professor"]
                            )

        model.Add(sum(plans_semana) == PLANEJAMENTOS_SEMANAIS).OnlyEnforceIf(lits["planejamento"])

    # ------------------------------------------------------------------
    # 6. Objetivo: planejamento compartilhado com ao menos 1 colega da mesma área
    #    e aulas nos horários preferenciais dos professores
    # ------------------------------------------------------------------
    compartilhado: Dict[Tuple[str, str, str, str], cp_model.IntVar] = {}
    for (chave, dia, turno, h), p in plan.items():
        minhas_areas = areas_prof.get(chave, set())
        if not minhas_areas:
            continue
        colegas = [
            p2
            for (c2, d2, _, h2), p2 in plan.items()
            if c2 != chave and d2 == dia and areas_prof.get(c2, set()) & minhas_areas and slots_overlap(h, h2)
        ]
        if not colegas:
            continue
        s = model.NewBoolVar(f"compart_{chave}_{dia}_{h}")
        model.Add(s <= p)
        model.Add(s <= sum(colegas))
        compartilhado[(chave, dia, turno, h)] = s
    # Aulas em horários marcados como preferenciais pelo professor (peso menor)
    preferidas = [
        var
        for chave, prof in professores.items()
        if prof.preferencial
        for var, dia, horario, nivel in prof_aulas_nivel.get(chave, [])
        if any(pref.aplica(dia, horario, nivel) for pref in prof.preferencial)
    ]
    # Concentrar as tardes vem antes de tudo: uma tarde a mais custa mais que o máximo
    # que planejamento compartilhado e preferências juntos podem render
    peso_tarde = 3 * len(compartilhado) + len(preferidas) + 1
    if compartilhado or preferidas or tardes_usadas:
        model.Maximize(3 * sum(compartilhado.values()) + sum(preferidas) - peso_tarde * sum(tardes_usadas))

    # ------------------------------------------------------------------
    # 7. Resolução
    # ------------------------------------------------------------------
    # Assumptions atrapalham muito o presolve, então a 1ª tentativa fixa todas as regras
    # e só uma cópia do modelo (sem objetivo) usa assumptions para diagnosticar a inviabilidade.
    diagnostico = model.Clone()
    for nome, lit in lits.items():
        model.Add(lit == (0 if nome in regras_desligadas else 1))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = tempo_limite_seg
    solver.parameters.num_workers = workers
    status = solver.Solve(model)
    tempo = round(solver.WallTime(), 3)

    if status == cp_model.INFEASIBLE:
        diagnostico.ClearObjective()
        diagnostico.AddAssumptions(
            [diagnostico.GetBoolVarFromProtoIndex(l.Index()) for n, l in lits.items() if n not in regras_desligadas]
        )
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = tempo_limite_seg
        solver.parameters.num_workers = workers
        solver.Solve(diagnostico)
        tempo = round(tempo + solver.WallTime(), 3)
        indices = set(solver.SufficientAssumptionsForInfeasibility())
        conflito = [nome for nome, lit in lits.items() if lit.Index() in indices]
        if conflito:
            descricao = "; ".join(REGRAS[n] for n in conflito)
            mensagem = f"Não foi possível montar a grade. Estas regras entram em conflito com os dados atuais: {descricao}."
        else:
            mensagem = (
                "Não foi possível montar a grade: as aulas da matriz curricular não cabem nos horários "
                "sem choque de turma ou de professor."
            )
        res = _inviavel(mensagem, avisos)
        res.regras_em_conflito = conflito
        res.solver_status = solver.StatusName(status)
        res.tempo_seg = tempo
        return res

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResult(
            sucesso=False,
            status="tempo_esgotado",
            mensagem=f"O solver não encontrou uma grade em {tempo_limite_seg:.0f}s. Tente novamente ou revise as restrições.",
            avisos=avisos,
            solver_status=solver.StatusName(status),
            tempo_seg=tempo,
        )

    aulas: List[AulaAlocada] = []
    for t in turmas:
        for idx, item in enumerate(t.itens):
            for dia in DIAS_SEMANA:
                for s in turma_slots[t.id]:
                    chave_x = (t.id, idx, dia, s["ordem"])
                    if not solver.Value(x[chave_x]):
                        continue
                    sala_id = next((sid for sid, v in escolha_sala[chave_x] if solver.Value(v)), None)
                    aulas.append(
                        AulaAlocada(
                            turma_id=t.id,
                            turma_nome=t.nome,
                            disciplina=item.disciplina,
                            professor_chaves=list(item.professores),
                            sala_id=sala_id,
                            dia=dia,
                            horario=s["horario"],
                            ordem=s["ordem"],
                        )
                    )

    planejamentos = [
        PlanejamentoAlocado(
            professor_chave=k[0],
            dia=k[1],
            horario=k[3],
            compartilhado=bool(k in compartilhado and solver.Value(compartilhado[k])),
        )
        for k, p in plan.items()
        if solver.Value(p)
    ]

    return SolverResult(
        sucesso=True,
        status="sucesso",
        mensagem="Grade gerada com sucesso respeitando todas as regras!",
        aulas=aulas,
        planejamentos=planejamentos,
        avisos=avisos,
        solver_status=solver.StatusName(status),
        tempo_seg=tempo,
    )
