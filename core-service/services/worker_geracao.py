"""
Worker da geração de grades, num processo (container) separado da API.

A API só cria a grade com status "gerando"; o worker pega a mais antiga nesse status e
roda o solver. Assim, reiniciar a API não interrompe uma geração. Se o próprio worker
parar no meio, ao voltar ele refaz a geração do zero; depois de MAX_TENTATIVAS
interrupções seguidas (ex.: falta de memória), a grade fica com status "erro".

Rodar: python -m services.worker_geracao
"""
import logging
import time
from typing import Optional

from sqlalchemy.orm import Session

from database.models import GradeDB
from services.grid_generator import GridGeneratorService, TEMPO_LIMITE_SEG

logger = logging.getLogger(__name__)

INTERVALO_SEG = 2
MAX_TENTATIVAS = 2


def proxima_pendente(db: Session) -> Optional[GradeDB]:
    return db.query(GradeDB).filter(GradeDB.status == "gerando").order_by(GradeDB.id).first()


def executar_geracao(session_factory, grade_id: int) -> None:
    """Roda o solver e grava o resultado (ou o erro) na grade."""
    db = session_factory()
    try:
        grade = db.get(GradeDB, grade_id)
        detalhes = grade.detalhes or {}
        tentativa = int(detalhes.get("tentativas", 0)) + 1
        if tentativa > MAX_TENTATIVAS:
            grade.status = "erro"
            grade.detalhes = {
                **detalhes,
                "mensagem": f"A geração foi interrompida {MAX_TENTATIVAS} vezes antes de terminar "
                "(o servidor pode estar sem memória). Tente de novo com menos tempo de solver.",
            }
            db.commit()
            return
        # Gravado antes de rodar: se o processo cair no meio, a próxima vez sabe que já tentou
        grade.detalhes = {**detalhes, "tentativas": tentativa}
        db.commit()
        logger.info("Gerando a grade %s (tentativa %s)", grade_id, tentativa)
        GridGeneratorService(db).generate(
            grade=grade, tempo_limite_seg=float(detalhes.get("tempo_limite_seg") or TEMPO_LIMITE_SEG)
        )
        logger.info("Grade %s terminou com status %s", grade_id, grade.status)
    except Exception:
        logger.exception("Falha na geração da grade %s", grade_id)
        db.rollback()
        grade = db.get(GradeDB, grade_id)
        grade.status = "erro"
        grade.detalhes = {**(grade.detalhes or {}), "mensagem": "Erro inesperado ao gerar a grade."}
        db.commit()
    finally:
        db.close()


def processar_pendentes(session_factory) -> int:
    """Gera as grades que estão na fila, uma por vez; devolve quantas foram processadas."""
    processadas = 0
    while True:
        with session_factory() as db:
            grade = proxima_pendente(db)
            grade_id = grade.id if grade else None
        if grade_id is None:
            return processadas
        executar_geracao(session_factory, grade_id)
        processadas += 1


def main() -> None:
    from database.connection import SessionLocal

    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
    logger.setLevel(logging.INFO)
    logger.info("Worker de geração iniciado")
    while True:
        try:
            processar_pendentes(SessionLocal)
        except Exception:
            # Ex.: banco ainda subindo ou tabelas ainda não criadas pela API; tenta de novo
            logger.exception("Erro ao buscar gerações pendentes")
        time.sleep(INTERVALO_SEG)


if __name__ == "__main__":
    main()
