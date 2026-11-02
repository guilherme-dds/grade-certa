from sqlalchemy.orm import Session

from database.models import ConfiguracaoEscolaDB
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
    )
