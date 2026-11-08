"""
Planejamentos e janelas dos professores a partir das aulas gravadas de uma grade.

O gerador decide os dois junto com as aulas. Depois de uma edição manual, eles são
refeitos aqui sem resolver a grade de novo: planejamentos que continuam válidos ficam
onde estão e os que deixaram de caber (aula no mesmo horário, dia sem aula, almoço ou
duração do dia) são realocados, preferindo tapar janelas, ficar colados às aulas e
coincidir com um colega da mesma área.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Union

from sqlalchemy.orm import Session

from database.models import DisciplinaDB, DisponibilidadeDB, GradeDB, ProfessorDB, TurmaDB
from services.grid_solver import (
    PLANEJAMENTOS_SEMANAIS,
    Almoco,
    Intervalo,
    _opcoes_almoco,
    inferir_area,
    normalizar,
)
from services.jornada import jornada_do_professor, jornada_padrao
from services.time_slots import DIAS_SEMANA, get_slots_for_turma, parse_slot_range, slots_overlap

# Professor cadastrado pelo id; sem cadastro, pelo nome
Chave = Union[int, str]


def _chave(professor_id: Optional[int], nome: Optional[str]) -> Chave:
    return professor_id if professor_id is not None else (nome or "")


@dataclass
class _Professor:
    id: Optional[int]
    nome: str
    linha: Dict[str, List[str]] = field(default_factory=lambda: {"manha": [], "tarde": []})
    aulas: Dict[str, List[str]] = field(default_factory=dict)  # dia -> horários com aula
    areas: Set[str] = field(default_factory=set)
    indisponivel: List[Intervalo] = field(default_factory=list)
    almoco: Optional[Almoco] = None
    max_minutos_dia: Optional[int] = None

    def horarios_dia(self) -> List[str]:
        """Linha do dia inteiro: horários das turmas do professor, manhã e depois tarde."""
        return sorted(self.linha["manha"]) + sorted(self.linha["tarde"])


class _Dia:
    """Um dia de um professor: quais horários da linha têm aula ou planejamento."""

    def __init__(self, prof: _Professor, dia: str, planos: List[str]):
        self.prof = prof
        self.horarios = prof.horarios_dia()
        aulas = prof.aulas.get(dia, [])
        self.ocupado = [any(slots_overlap(h, a) for a in aulas) for h in self.horarios]
        self.planos = list(planos)

    def presente(self) -> List[bool]:
        return [o or h in self.planos for h, o in zip(self.horarios, self.ocupado)]

    def _opcoes_livres(self, pres: List[bool]) -> Optional[List[List[int]]]:
        """Opções de almoço que cabem; None = sem almoço a respeitar ou já cabe num intervalo."""
        opcoes = _opcoes_almoco(self.prof.almoco, self.horarios) if self.prof.almoco else []
        if not opcoes:
            return None
        return [o for o in opcoes if not any(pres[i] for i in o)]

    def almoco_cabe(self) -> bool:
        livres = self._opcoes_livres(self.presente())
        return livres is None or bool(livres)

    def minutos(self) -> int:
        faixas = [parse_slot_range(h) for h, p in zip(self.horarios, self.presente()) if p]
        return max(f for _, f in faixas) - min(i for i, _ in faixas) if faixas else 0

    def janelas(self) -> List[str]:
        """Horários vagos entre duas presenças; o almoço (a pausa que mais desconta) não conta."""
        pres = self.presente()
        n = len(self.horarios)
        vagos = []
        for j in range(1, n - 1):
            hj = self.horarios[j]
            antes = any(pres[i] for i in range(j) if not slots_overlap(self.horarios[i], hj))
            depois = any(pres[k] for k in range(j + 1, n) if not slots_overlap(hj, self.horarios[k]))
            coberto = self.ocupado[j] or any(slots_overlap(hj, p) for p in self.planos)
            if antes and depois and not coberto:
                vagos.append(j)
        livres = self._opcoes_livres(pres) or []
        pausa = max(livres, key=lambda o: sum(1 for j in vagos if j in o), default=[])
        return [self.horarios[j] for j in vagos if j not in pausa]


class AgendaProfessores:
    def __init__(self, db: Session, grade: GradeDB):
        self.grade = grade
        turmas = {t.id: t for t in db.query(TurmaDB).all()}
        disciplinas = {normalizar(d.nome): d for d in db.query(DisciplinaDB).all()}
        cadastro = {p.id: p for p in db.query(ProfessorDB).all()}
        padrao = jornada_padrao(db)
        indisp: Dict[int, List[Intervalo]] = {}
        for d in db.query(DisponibilidadeDB).filter(DisponibilidadeDB.tipo == "indisponivel").all():
            indisp.setdefault(d.professor_id, []).append(Intervalo(d.dia_semana, f"{d.horario_inicio} - {d.horario_fim}"))

        self.professores: Dict[Chave, _Professor] = {}
        slots_turma: Dict[int, List[dict]] = {}
        for aula in grade.aulas:
            turma = turmas.get(aula.turma_id)
            if turma and turma.id not in slots_turma:
                slots_turma[turma.id] = get_slots_for_turma(turma.turno, turma.nivel_ensino, turma.nome)
            disc = disciplinas.get(normalizar(aula.disciplina_nome or ""))
            area = disc.area if disc and disc.area else inferir_area(aula.disciplina_nome or "")
            # Aulas antigas guardam só o professor principal
            lista = aula.professores or (
                [{"id": aula.professor_id, "nome": aula.professor_nome}] if aula.professor_id or aula.professor_nome else []
            )
            for p in lista:
                chave = _chave(p.get("id"), p.get("nome"))
                prof = self.professores.get(chave)
                if prof is None:
                    jornada = jornada_do_professor(cadastro.get(p.get("id")), padrao)
                    prof = self.professores[chave] = _Professor(
                        id=p.get("id"),
                        nome=p.get("nome") or "",
                        indisponivel=indisp.get(p.get("id"), []),
                        almoco=(
                            Almoco(jornada.almoco_inicio, jornada.almoco_fim, jornada.almoco_minutos)
                            if jornada.almoco_minutos
                            else None
                        ),
                        max_minutos_dia=round(jornada.max_horas_dia * 60) if jornada.max_horas_dia else None,
                    )
                prof.aulas.setdefault(aula.dia_semana, []).append(aula.horario)
                prof.areas.add(area or normalizar(aula.disciplina_nome or ""))
                for s in slots_turma.get(aula.turma_id, []):
                    if s["horario"] not in prof.linha[s["turno"]]:
                        prof.linha[s["turno"]].append(s["horario"])

    def _cabe(self, prof: _Professor, dia: str, planos: List[str], horario: str) -> bool:
        """O planejamento pode ficar neste horário sem ferir as regras do dia do professor."""
        if not prof.aulas.get(dia) or horario not in prof.horarios_dia():
            return False
        if any(slots_overlap(horario, p) for p in planos):
            return False
        if any(ind.aplica(dia, horario) for ind in prof.indisponivel):
            return False
        antes = _Dia(prof, dia, planos)
        if antes.ocupado[antes.horarios.index(horario)]:
            return False
        depois = _Dia(prof, dia, planos + [horario])
        if antes.almoco_cabe() and not depois.almoco_cabe():
            return False
        maximo = prof.max_minutos_dia
        if maximo and depois.minutos() > max(maximo, antes.minutos()):
            return False
        return True

    def recalcular(self) -> dict:
        """Novos `planejamentos` e `janelas` para os detalhes da grade."""
        antigos: Dict[Chave, List[dict]] = {}
        for p in (self.grade.detalhes or {}).get("planejamentos", []):
            antigos.setdefault(_chave(p.get("professor_id"), p.get("professor")), []).append(p)

        planos: Dict[Chave, Dict[str, List[str]]] = {}
        faltam: List[Chave] = []
        for chave, prof in self.professores.items():
            por_dia: Dict[str, List[str]] = {}
            for p in antigos.get(chave, []):
                dia = p.get("dia_semana")
                if self._cabe(prof, dia, por_dia.get(dia, []), p.get("horario")):
                    por_dia.setdefault(dia, []).append(p["horario"])
            planos[chave] = por_dia
            if sum(map(len, por_dia.values())) < PLANEJAMENTOS_SEMANAIS:
                faltam.append(chave)

        for chave in faltam:
            self._completar(chave, planos)

        planejamentos = []
        janelas = []
        for chave, prof in self.professores.items():
            for dia in DIAS_SEMANA:
                for h in sorted(planos[chave].get(dia, [])):
                    planejamentos.append({
                        "professor": prof.nome,
                        "professor_id": prof.id,
                        "dia_semana": dia,
                        "horario": h,
                        "compartilhado": self._colega(chave, dia, h, planos),
                    })
                if prof.aulas.get(dia):
                    for h in _Dia(prof, dia, planos[chave].get(dia, [])).janelas():
                        janelas.append({"professor": prof.nome, "professor_id": prof.id, "dia_semana": dia, "horario": h})
        return {"planejamentos": planejamentos, "janelas": janelas}

    def _colega(self, chave: Chave, dia: str, horario: str, planos: Dict[Chave, Dict[str, List[str]]]) -> bool:
        """Algum colega da mesma área planeja num horário que se sobrepõe a este."""
        areas = self.professores[chave].areas
        return any(
            outro != chave
            and self.professores[outro].areas & areas
            and any(slots_overlap(horario, h) for h in por_dia.get(dia, []))
            for outro, por_dia in planos.items()
        )

    def _completar(self, chave: Chave, planos: Dict[Chave, Dict[str, List[str]]]) -> None:
        prof = self.professores[chave]
        por_dia = planos[chave]
        while sum(map(len, por_dia.values())) < PLANEJAMENTOS_SEMANAIS:
            melhor: Optional[Tuple[int, str, str]] = None
            for dia in DIAS_SEMANA:
                atuais = por_dia.get(dia, [])
                if not prof.aulas.get(dia):
                    continue
                janelas_antes = len(_Dia(prof, dia, atuais).janelas())
                for h in prof.horarios_dia():
                    if not self._cabe(prof, dia, atuais, h):
                        continue
                    novo = _Dia(prof, dia, atuais + [h])
                    pres = novo.presente()
                    i = novo.horarios.index(h)
                    colado = any(
                        pres[k] and k != i and not slots_overlap(h, novo.horarios[k])
                        for k in (i - 1, i + 1)
                        if 0 <= k < len(pres)
                    )
                    nota = (
                        100 * (janelas_antes - len(novo.janelas()))
                        + 10 * colado
                        + 3 * self._colega(chave, dia, h, planos)
                    )
                    if melhor is None or nota > melhor[0]:
                        melhor = (nota, dia, h)
            if melhor is None:
                return
            por_dia.setdefault(melhor[1], []).append(melhor[2])


def recalcular_agenda(db: Session, grade: GradeDB) -> None:
    """Atualiza planejamentos e janelas da grade depois de uma mudança nas aulas."""
    grade.detalhes = {**(grade.detalhes or {}), **AgendaProfessores(db, grade).recalcular()}
