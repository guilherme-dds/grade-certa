from typing import List, Dict, Any, Optional, Tuple

DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex"]

NIVEL_ENSINO_MEDIO = "Ensino Médio"
NIVEL_ANOS_FINAIS = "Anos Finais"
NIVEL_ANOS_INICIAIS = "Anos Iniciais"

# Horários oficiais por Nível de Ensino e Turno
TIME_SLOTS_BY_NIVEL: Dict[str, Dict[str, List[str]]] = {
    NIVEL_ENSINO_MEDIO: {
        "manha": [
            "07:20 - 08:10",
            "08:10 - 09:00",
            "09:15 - 10:05",
            "10:05 - 10:55",
            "11:10 - 12:00",
            "12:00 - 12:50",
        ],
        "tarde": [
            "13:50 - 14:40",
            "14:40 - 15:30",
            "15:50 - 16:40",
            "16:40 - 17:30",
        ],
    },
    NIVEL_ANOS_FINAIS: {
        "manha": [
            "07:20 - 08:10",
            "08:10 - 09:00",
            "09:00 - 09:50",
            "10:10 - 11:00",
            "11:00 - 11:50",
            "11:50 - 12:40",
        ],
        "tarde": [
            "13:00 - 13:50",
            "13:50 - 14:40",
            "14:40 - 15:30",
            "15:50 - 16:40",
            "16:40 - 17:30",
            "17:30 - 18:20",
        ],
    },
    NIVEL_ANOS_INICIAIS: {
        "manha": [
            "07:20 - 08:10",
            "08:10 - 09:00",
            "09:20 - 10:10",
            "10:10 - 11:00",
            "11:00 - 11:50",
            "11:50 - 12:40",
        ],
        "tarde": [
            "13:00 - 13:50",
            "13:50 - 14:40",
            "14:40 - 15:30",
            "15:50 - 16:40",
            "16:40 - 17:30",
            "17:30 - 18:20",
        ],
    },
}


def parse_time_to_minutes(time_str: str) -> int:
    """Converte '07:20' ou '7:20' em minutos desde a meia-noite."""
    parts = time_str.strip().split(":")
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return hours * 60 + minutes


def parse_slot_range(slot_str: str) -> Tuple[int, int]:
    """Converte '07:20 - 08:10' na tupla de minutos (440, 490)."""
    parts = slot_str.split("-")
    start = parse_time_to_minutes(parts[0])
    end = parse_time_to_minutes(parts[1])
    return start, end


def slots_overlap(slot_a: str, slot_b: str) -> bool:
    """
    Retorna True se dois horários se sobrepõem no tempo.
    Dois intervalos [start1, end1] e [start2, end2] se sobrepõem se e somente se:
    start1 < end2 and start2 < end1.
    """
    s1, e1 = parse_slot_range(slot_a)
    s2, e2 = parse_slot_range(slot_b)
    return s1 < e2 and s2 < e1


def infer_nivel_ensino(turma_nome: str, nivel_informado: Optional[str] = None) -> str:
    """
    Identifica o nível de ensino a partir do valor informado ou pelo nome da turma.
    Exemplos: '1º EM A' -> 'Ensino Médio', '6º Ano B' -> 'Anos Finais'.
    """
    if nivel_informado:
        clean = nivel_informado.strip().lower()
        if "médio" in clean or "medio" in clean:
            return NIVEL_ENSINO_MEDIO
        if "finais" in clean:
            return NIVEL_ANOS_FINAIS
        if "iniciais" in clean:
            return NIVEL_ANOS_INICIAIS

    nome = (turma_nome or "").strip().lower()
    if any(k in nome for k in ["em", "médio", "medio", "1º em", "2º em", "3º em", "terceirão"]):
        return NIVEL_ENSINO_MEDIO
    if any(k in nome for k in ["6º", "7º", "8º", "9º", "6o", "7o", "8o", "9o"]):
        return NIVEL_ANOS_FINAIS
    if any(k in nome for k in ["1º", "2º", "3º", "4º", "5º", "1o", "2o", "3o", "4o", "5o"]):
        return NIVEL_ANOS_INICIAIS

    return NIVEL_ANOS_FINAIS


def get_slots_for_turma(turno: str, nivel_ensino: Optional[str] = None, turma_nome: str = "") -> List[Dict[str, Any]]:
    """
    Retorna a lista de horários de aula aplicáveis para uma turma específica,
    considerando seu turno e nível de ensino.
    """
    nivel = infer_nivel_ensino(turma_nome, nivel_ensino)
    schedules = TIME_SLOTS_BY_NIVEL.get(nivel, TIME_SLOTS_BY_NIVEL[NIVEL_ANOS_FINAIS])

    turno_clean = (turno or "").strip().lower()
    if "tarde" in turno_clean or "vespertino" in turno_clean:
        turnos = ["tarde"]
    elif "integral" in turno_clean:
        turnos = ["manha", "tarde"]
    else:
        turnos = ["manha"]

    horarios = [(t, h) for t in turnos for h in schedules[t]]

    return [
        {
            "ordem": idx + 1,
            "horario": h,
            "inicio_minutos": parse_slot_range(h)[0],
            "fim_minutos": parse_slot_range(h)[1],
            "nivel": nivel,
            "turno": t,
        }
        for idx, (t, h) in enumerate(horarios)
    ]
