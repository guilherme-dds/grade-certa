from typing import Optional

from sqlalchemy.orm import Session

from database.models import ConfiguracaoEscolaDB, ProfessorDB
from models.jornada import Jornada


def jornada_padrao(db: Session) -> Jornada:
    """Jornada da escola; enquanto ninguém salvou uma, vale o padrão do sistema."""
    config = db.query(ConfiguracaoEscolaDB).first()
    if not config:
        return Jornada()
    return Jornada(
        almoco_inicio=config.almoco_inicio,
        almoco_fim=config.almoco_fim,
        almoco_minutos=config.almoco_minutos,
        max_aulas_dia=config.max_aulas_dia,
        max_horas_dia=config.max_horas_dia,
    )


def jornada_do_professor(prof: Optional[ProfessorDB], padrao: Jornada) -> Jornada:
    """A jornada personalizada do professor ou, sem ela, a da escola."""
    return Jornada(**prof.jornada) if prof and prof.jornada else padrao
