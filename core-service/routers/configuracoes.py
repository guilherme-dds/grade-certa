from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import ConfiguracaoEscolaDB
from models.jornada import Jornada
from services.jornada import jornada_padrao

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])


@router.get("/jornada", response_model=Jornada)
def obter_jornada_padrao(db: Session = Depends(get_db)):
    return jornada_padrao(db)


@router.put("/jornada", response_model=Jornada)
def salvar_jornada_padrao(jornada: Jornada, db: Session = Depends(get_db)):
    """Vale para todos os professores sem jornada personalizada, nas próximas gerações."""
    config = db.query(ConfiguracaoEscolaDB).first()
    if not config:
        config = ConfiguracaoEscolaDB()
        db.add(config)
    config.almoco_inicio = jornada.almoco_inicio
    config.almoco_fim = jornada.almoco_fim
    config.almoco_minutos = jornada.almoco_minutos
    config.max_aulas_dia = jornada.max_aulas_dia
    db.commit()
    return jornada
