"""
Detecta conflitos em uma grade já gravada (normalmente causados por edição manual de aulas)
e sugere um horário livre para a aula que conflita.

Além dos choques (turma, professor, sala) e das indisponibilidades, aponta as regras que o
gerador segue e que uma edição pode quebrar: almoço, máximo de aulas e duração do dia do
professor, aula dobrada e primeira/última aula do turno. As sugestões não pioram essas regras.
"""
import zlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session, joinedload

from database.models import AulaDB, DisciplinaDB, DisponibilidadeDB, GradeDB, ProfessorDB, SalaDB, TurmaDB
from models.jornada import Jornada
from services.grid_solver import Almoco, Intervalo, _opcoes_almoco, inferir_aula_dobrada, normalizar
from services.jornada import jornada_do_professor, jornada_padrao
from services.time_slots import (
    DIAS_SEMANA,
    get_slots_for_turma,
    infer_nivel_ensino,
    parse_slot_range,
    slots_overlap,
)

# Professor cadastrado pelo id; sem cadastro, pelo nome
ChaveProf = Tuple[str, Any]
# Aula movida numa simulação: (id da aula, dia, horário)
Movimento = Optional[Tuple[int, str, str]]

TURNO = {"manha": "manhã", "tarde": "tarde"}


def horarios_da_turma(turma: Optional[TurmaDB]) -> List[str]:
    if turma is None:
        return []
    return [s["horario"] for s in get_slots_for_turma(turma.turno, turma.nivel_ensino, turma.nome)]


def _hhmm(minutos: int) -> str:
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


@dataclass
class _Violacao:
    tipo: str
    gravidade: str
    descricao: str
    aula: AulaDB


class DetectorConflitos:
    def __init__(self, db: Session, grade: GradeDB):
        self.aulas: List[AulaDB] = sorted(grade.aulas, key=lambda a: a.id)
        self.turmas = {t.id: t for t in db.query(TurmaDB).all()}
        self.indisp_prof: Dict[int, List[Intervalo]] = {}
        for d in db.query(DisponibilidadeDB).filter(DisponibilidadeDB.tipo == "indisponivel").all():
            self.indisp_prof.setdefault(d.professor_id, []).append(
                Intervalo(d.dia_semana, f"{d.horario_inicio} - {d.horario_fim}", d.nivel_ensino)
            )
        self.indisp_sala: Dict[str, List[Intervalo]] = {
            s.nome: [Intervalo(i.dia_semana, f"{i.horario_inicio} - {i.horario_fim}") for i in s.indisponibilidades]
            for s in db.query(SalaDB).options(joinedload(SalaDB.indisponibilidades)).all()
        }
        self._carregar_regras(db, grade)

    # ------------------------------------------------------------------
    # Dados das regras de professor e de turma
    # ------------------------------------------------------------------
    def _carregar_regras(self, db: Session, grade: GradeDB) -> None:
        self.slots_turma: Dict[int, List[dict]] = {
            tid: get_slots_for_turma(t.turno, t.nivel_ensino, t.nome) for tid, t in self.turmas.items()
        }
        cadastro = {p.id: p for p in db.query(ProfessorDB).all()}
        padrao = jornada_padrao(db)
        self.nome_prof: Dict[ChaveProf, str] = {}
        self.jornada: Dict[ChaveProf, Jornada] = {}
        self.aulas_prof: Dict[ChaveProf, List[AulaDB]] = {}
        # Linha do dia do professor: horários das turmas em que dá aula, manhã e depois tarde
        self.linha_prof: Dict[ChaveProf, List[str]] = {}
        por_turno: Dict[ChaveProf, Dict[str, Set[str]]] = {}
        for aula in self.aulas:
            for p in self._professores(aula):
                chave = self._chave(p)
                self.nome_prof.setdefault(chave, p.get("nome") or "")
                self.jornada.setdefault(chave, jornada_do_professor(cadastro.get(p.get("id")), padrao))
                self.aulas_prof.setdefault(chave, []).append(aula)
                for s in self.slots_turma.get(aula.turma_id, []):
                    por_turno.setdefault(chave, {"manha": set(), "tarde": set()})[s["turno"]].add(s["horario"])
        for chave, turnos in por_turno.items():
            self.linha_prof[chave] = sorted(turnos["manha"]) + sorted(turnos["tarde"])

        self.planos: Dict[Tuple[ChaveProf, str], List[str]] = {}
        for p in (grade.detalhes or {}).get("planejamentos", []):
            chave = self._chave({"id": p.get("professor_id"), "nome": p.get("professor")})
            self.planos.setdefault((chave, p.get("dia_semana")), []).append(p.get("horario"))

        # Aula dobrada por disciplina; quem fixou horário exato já decidiu a distribuição
        disciplinas = {normalizar(d.nome): d for d in db.query(DisciplinaDB).all()}
        self.dobrada: Dict[str, bool] = {}
        self.fixos_exatos: Set[Tuple[int, str]] = set()
        for aula in self.aulas:
            nome = normalizar(aula.disciplina_nome or "")
            if nome not in self.dobrada:
                disc = disciplinas.get(nome)
                self.dobrada[nome] = (
                    disc.aula_dobrada
                    if disc and disc.aula_dobrada is not None
                    else inferir_aula_dobrada(aula.disciplina_nome or "")
                )
        for tid, turma in self.turmas.items():
            for item in turma.matriz_curricular or []:
                if isinstance(item, dict) and any(h.get("horario") for h in item.get("horarios_fixos") or []):
                    self.fixos_exatos.add((tid, normalizar(item.get("disciplina") or "")))

    @staticmethod
    def _chave(p: Dict[str, Any]) -> ChaveProf:
        return ("id", p["id"]) if p.get("id") is not None else ("nome", normalizar(p.get("nome") or ""))

    @staticmethod
    def _pos(aula: AulaDB, mov: Movimento) -> Tuple[str, str]:
        if mov and mov[0] == aula.id:
            return mov[1], mov[2]
        return aula.dia_semana, aula.horario

    def _turno_da_aula(self, aula: AulaDB, horario: str) -> Tuple[Optional[str], int]:
        """Turno e posição do horário na grade da turma (-1 se não existir)."""
        slots = self.slots_turma.get(aula.turma_id, [])
        for i, s in enumerate(slots):
            if s["horario"] == horario:
                return s["turno"], i
        return None, -1

    # ------------------------------------------------------------------
    # Regras do dia de um professor
    # ------------------------------------------------------------------
    def _violacoes_professor(self, chave: ChaveProf, dia: str, mov: Movimento = None) -> List[_Violacao]:
        aulas = sorted(
            (a for a in self.aulas_prof.get(chave, []) if self._pos(a, mov)[0] == dia),
            key=lambda a: parse_slot_range(self._pos(a, mov)[1]),
        )
        if not aulas:
            return []
        nome = self.nome_prof[chave]
        jornada = self.jornada[chave]
        planos = self.planos.get((chave, dia), [])
        # Um planejamento sob a aula movida sai quando a agenda é recalculada
        horarios_aula = [self._pos(a, mov)[1] for a in aulas]
        planos = [h for h in planos if not any(slots_overlap(h, ha) for ha in horarios_aula)]
        violacoes: List[_Violacao] = []

        if jornada.max_aulas_dia and len(aulas) > jornada.max_aulas_dia:
            violacoes.append(_Violacao(
                "Aulas demais no dia", "medio",
                f"{nome} tem {len(aulas)} aulas em {dia}; o máximo é {jornada.max_aulas_dia}.", aulas[-1],
            ))

        faixas = [parse_slot_range(h) for h in horarios_aula + planos]
        inicio, fim = min(i for i, _ in faixas), max(f for _, f in faixas)
        if jornada.max_horas_dia and fim - inicio > round(jornada.max_horas_dia * 60):
            # A aula que estica o dia: a última, se é ela que fecha o dia; senão a primeira
            aula = aulas[-1] if parse_slot_range(horarios_aula[-1])[1] == fim else aulas[0]
            violacoes.append(_Violacao(
                "Dia longo demais", "medio",
                f"{nome} fica das {_hhmm(inicio)} às {_hhmm(fim)} em {dia}, acima do máximo de "
                f"{jornada.max_horas_dia:g} h.", aula,
            ))

        if jornada.almoco_minutos:
            violacao = self._sem_almoco(chave, dia, aulas, horarios_aula, planos, jornada)
            if violacao:
                violacoes.append(violacao)

        violacoes += self._primeira_e_ultima(chave, dia, aulas, mov)
        return violacoes

    def _sem_almoco(self, chave, dia, aulas, horarios_aula, planos, jornada: Jornada) -> Optional[_Violacao]:
        linha = self.linha_prof.get(chave, [])
        opcoes = _opcoes_almoco(Almoco(jornada.almoco_inicio, jornada.almoco_fim, jornada.almoco_minutos), linha)
        ocupado = [h in planos or any(slots_overlap(h, ha) for ha in horarios_aula) for h in linha]
        if not opcoes or any(not any(ocupado[i] for i in o) for o in opcoes):
            return None
        # Aula dentro da faixa do almoço (a mais tarde), que é a que precisa sair
        ini, fim = jornada.almoco_inicio, jornada.almoco_fim
        na_faixa = [a for a, h in zip(aulas, horarios_aula) if slots_overlap(h, f"{ini} - {fim}")]
        return _Violacao(
            "Sem almoço", "medio",
            f"{self.nome_prof[chave]} não tem {jornada.almoco_minutos} min livres entre {ini} e {fim} em {dia}.",
            (na_faixa or aulas)[-1],
        )

    def _primeira_e_ultima(self, chave, dia, aulas: List[AulaDB], mov: Movimento) -> List[_Violacao]:
        """Quem dá a primeira aula de um turno não dá a última desse turno no mesmo dia."""
        ocupados: Dict[int, Set[int]] = {}  # turma -> posições com aula no dia
        for a in self.aulas:
            d, h = self._pos(a, mov)
            if d == dia:
                ocupados.setdefault(a.turma_id, set()).add(self._turno_da_aula(a, h)[1])

        primeira: Dict[str, AulaDB] = {}
        ultima: Dict[str, AulaDB] = {}
        for a in aulas:
            # Horário exato fixado pela escola não entra na regra
            if (a.turma_id, normalizar(a.disciplina_nome or "")) in self.fixos_exatos:
                continue
            turno, pos = self._turno_da_aula(a, self._pos(a, mov)[1])
            if turno is None:
                continue
            slots = self.slots_turma[a.turma_id]
            if pos == 0 or slots[pos - 1]["turno"] != turno:
                primeira.setdefault(turno, a)
            prox_no_turno = pos + 1 < len(slots) and slots[pos + 1]["turno"] == turno
            if not prox_no_turno or pos + 1 not in ocupados.get(a.turma_id, set()):
                ultima[turno] = a
        return [
            _Violacao(
                "Primeira e última aula", "medio",
                f"{self.nome_prof[chave]} dá a primeira e a última aula da {TURNO[turno]} em {dia} "
                f"({primeira[turno].turma_nome} e {ultima[turno].turma_nome}).",
                ultima[turno],
            )
            for turno in primeira
            if turno in ultima
        ]

    # ------------------------------------------------------------------
    # Aula dobrada (por turma e disciplina)
    # ------------------------------------------------------------------
    def _violacoes_dobrada(self, turma_id: int, disciplina: str, dia: str, mov: Movimento = None) -> List[_Violacao]:
        if (turma_id, disciplina) in self.fixos_exatos:
            return []
        aulas = [
            a for a in self.aulas
            if a.turma_id == turma_id and normalizar(a.disciplina_nome or "") == disciplina and self._pos(a, mov)[0] == dia
        ]
        if len(aulas) < 2:
            return []
        posicoes = sorted((self._turno_da_aula(a, self._pos(a, mov)[1]), a) for a in aulas)
        ultima = posicoes[-1][1]
        nome, turma = ultima.disciplina_nome, ultima.turma_nome
        if not self.dobrada.get(disciplina, True):
            descricao = f"{nome} é sempre aula individual, mas {turma} tem {len(aulas)} aulas em {dia}."
        elif len(aulas) > 2:
            descricao = f"{turma} tem {len(aulas)} aulas de {nome} em {dia}; o máximo é uma aula dobrada (2 seguidas)."
        else:
            (turno_a, pos_a), _ = posicoes[0]
            (turno_b, pos_b), _ = posicoes[1]
            if turno_a == turno_b and pos_b == pos_a + 1:
                return []
            descricao = f"As 2 aulas de {nome} em {dia} na {turma} não são seguidas."
        return [_Violacao("Aula dobrada", "medio", descricao, ultima)]

    def _violacoes_da_aula(self, aula: AulaDB, dias: Set[str], mov: Movimento = None) -> int:
        """Quantas regras estão quebradas nos dias afetados por mover esta aula."""
        disciplina = normalizar(aula.disciplina_nome or "")
        total = 0
        for dia in dias:
            for p in self._professores(aula):
                total += len(self._violacoes_professor(self._chave(p), dia, mov))
            total += len(self._violacoes_dobrada(aula.turma_id, disciplina, dia, mov))
        return total

    # ------------------------------------------------------------------
    # Choques, indisponibilidades e sugestão
    # ------------------------------------------------------------------
    def _nivel(self, aula: AulaDB) -> Optional[str]:
        turma = self.turmas.get(aula.turma_id)
        return infer_nivel_ensino(turma.nome, turma.nivel_ensino) if turma else None

    @staticmethod
    def _professores(aula: AulaDB) -> List[Dict[str, Any]]:
        if aula.professores:
            return aula.professores
        # Aulas gravadas antes da coluna `professores`
        return [{"id": aula.professor_id, "nome": aula.professor_nome}] if aula.professor_nome else []

    @classmethod
    def _professores_em_comum(cls, a: AulaDB, b: AulaDB) -> List[str]:
        """Nomes dos professores que estão nas duas aulas (por id; sem id, pelo nome)."""
        de_b = {cls._chave(p) for p in cls._professores(b)}
        return [p["nome"] for p in cls._professores(a) if cls._chave(p) in de_b]

    def _professores_indisponiveis(self, aula: AulaDB, dia: str, horario: str) -> List[str]:
        return [
            p["nome"]
            for p in self._professores(aula)
            if any(i.aplica(dia, horario, self._nivel(aula)) for i in self.indisp_prof.get(p.get("id"), []))
        ]

    def _sala_indisponivel(self, aula: AulaDB, dia: str, horario: str) -> bool:
        return any(i.aplica(dia, horario) for i in self.indisp_sala.get(aula.sala_nome or "", []))

    def _horario_livre(self, aula: AulaDB, dia: str, horario: str) -> bool:
        for outra in self.aulas:
            if outra.id == aula.id or outra.dia_semana != dia or not slots_overlap(outra.horario, horario):
                continue
            if outra.turma_id == aula.turma_id or self._professores_em_comum(outra, aula):
                return False
            if aula.sala_nome and outra.sala_nome == aula.sala_nome:
                return False
        return not self._professores_indisponiveis(aula, dia, horario) and not self._sala_indisponivel(aula, dia, horario)

    def _sugestao(self, aula: AulaDB, regra: bool = False) -> Tuple[Optional[str], Optional[Dict[str, str]]]:
        """
        Primeiro horário livre que não piora as regras nos dias envolvidos; para um conflito
        de regra, o horário precisa diminuir as regras quebradas.
        """
        antes: Dict[str, int] = {}
        for dia in DIAS_SEMANA:
            for horario in horarios_da_turma(self.turmas.get(aula.turma_id)):
                if (dia, horario) == (aula.dia_semana, aula.horario) or not self._horario_livre(aula, dia, horario):
                    continue
                dias = {aula.dia_semana, dia}
                if dia not in antes:
                    antes[dia] = self._violacoes_da_aula(aula, dias)
                depois = self._violacoes_da_aula(aula, dias, (aula.id, dia, horario))
                if depois < antes[dia] or (not regra and depois == antes[dia]):
                    texto = f"Mover {aula.disciplina_nome} ({aula.turma_nome}) para {dia}, {horario}."
                    return texto, {"dia_semana": dia, "horario": horario}
        return None, None

    def _conflito(
        self, tipo: str, gravidade: str, descricao: str, aula: AulaDB, outra: Optional[AulaDB] = None, regra: bool = False
    ):
        sugestao, correcao = self._sugestao(aula, regra)
        return {
            # A descrição entra no id porque a mesma dupla de aulas pode conflitar em mais de um professor
            "id": f"{tipo}-{aula.id}-{outra.id if outra else 0}-{zlib.crc32(descricao.encode())}",
            "gravidade": gravidade,
            "tipo": tipo,
            "descricao": descricao,
            "aula_id": aula.id,
            "turma_nome": aula.turma_nome,
            "sugestao": sugestao,
            "correcao": correcao,
        }

    def detectar(self) -> List[Dict[str, Any]]:
        conflitos = []
        for i, a in enumerate(self.aulas):
            for b in self.aulas[i + 1:]:
                if a.dia_semana != b.dia_semana or not slots_overlap(a.horario, b.horario):
                    continue
                quando = f"{b.dia_semana}, {b.horario}"
                if a.turma_id == b.turma_id:
                    conflitos.append(self._conflito(
                        "Choque de turma", "alto",
                        f"{a.turma_nome} tem {a.disciplina_nome} e {b.disciplina_nome} ao mesmo tempo ({quando}).", b, a,
                    ))
                for nome in self._professores_em_comum(a, b):
                    conflitos.append(self._conflito(
                        "Professor duplicado", "alto",
                        f"{nome} está em {a.turma_nome} e {b.turma_nome} ao mesmo tempo ({quando}).", b, a,
                    ))
                if a.sala_nome and a.sala_nome == b.sala_nome:
                    conflitos.append(self._conflito(
                        "Sala ocupada", "medio",
                        f"{b.sala_nome} reservada para {a.turma_nome} e {b.turma_nome} ao mesmo tempo ({quando}).", b, a,
                    ))

        for a in self.aulas:
            quando = f"{a.dia_semana}, {a.horario}"
            for nome in self._professores_indisponiveis(a, a.dia_semana, a.horario):
                conflitos.append(self._conflito(
                    "Professor indisponível", "alto",
                    f"{nome} marcou {quando} como indisponível ({a.disciplina_nome}, {a.turma_nome}).", a,
                ))
            if a.sala_nome and self._sala_indisponivel(a, a.dia_semana, a.horario):
                conflitos.append(self._conflito(
                    "Sala indisponível", "medio",
                    f"{a.sala_nome} está bloqueada em {quando} ({a.disciplina_nome}, {a.turma_nome}).", a,
                ))

        violacoes: List[_Violacao] = []
        for chave in self.aulas_prof:
            for dia in DIAS_SEMANA:
                violacoes += self._violacoes_professor(chave, dia)
        vistos = set()
        for a in self.aulas:
            k = (a.turma_id, normalizar(a.disciplina_nome or ""), a.dia_semana)
            if k not in vistos:
                vistos.add(k)
                violacoes += self._violacoes_dobrada(*k)
        for v in violacoes:
            conflitos.append(self._conflito(v.tipo, v.gravidade, v.descricao, v.aula, regra=True))
        return conflitos
