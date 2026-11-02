from pydantic import BaseModel, Field, model_validator

from services.time_slots import parse_time_to_minutes

HORA = r"^([01]\d|2[0-3]):[0-5]\d$"


class Jornada(BaseModel):
    """Almoço e limite diário: padrão da escola ou personalização de um professor."""

    # O professor precisa ter `almoco_minutos` seguidos livres dentro desta faixa
    almoco_inicio: str = Field(default="11:30", pattern=HORA)
    almoco_fim: str = Field(default="14:30", pattern=HORA)
    # 0 = sem exigência de almoço
    almoco_minutos: int = Field(default=40, ge=0, le=240)
    max_aulas_dia: int = Field(default=8, ge=1, le=12)

    @model_validator(mode="after")
    def _almoco_cabe_na_faixa(self):
        faixa = parse_time_to_minutes(self.almoco_fim) - parse_time_to_minutes(self.almoco_inicio)
        if faixa <= 0:
            raise ValueError("O fim da faixa de almoço precisa ser depois do início.")
        if self.almoco_minutos > faixa:
            raise ValueError("A duração do almoço não cabe na faixa informada.")
        return self
