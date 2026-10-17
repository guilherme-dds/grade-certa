from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database.connection import get_db
from database.models import GradeDB
from models.grade import Grade
from services.grid_generator import GridGeneratorService

router = APIRouter(prefix="/grade", tags=["grade"])


@router.post("/gerar-grade")
def gerar_grade(
    nome: Optional[str] = Query("Grade Horária Automática", description="Nome descritivo da grade"),
    db: Session = Depends(get_db),
):
    """
    Executa o algoritmo de geração automática de horários via Google OR-Tools CP-SAT.
    """
    service = GridGeneratorService(db)
    resultado = service.generate(nome_grade=nome)
    if not resultado["sucesso"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=resultado["mensagem"],
        )
    return resultado


@router.get("/", response_model=Grade)
def visualizar_grade(grade_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Retorna a grade horária gerada (a mais recente ou a especificada por grade_id).
    """
    query = db.query(GradeDB).options(joinedload(GradeDB.aulas))
    if grade_id:
        grade = query.filter(GradeDB.id == grade_id).first()
    else:
        grade = query.order_by(GradeDB.id.desc()).first()

    if not grade:
        return Grade(
            id=0,
            nome="Nenhuma grade gerada",
            status="sem_grade",
            total_aulas=0,
            aulas=[],
        )

    return grade


@router.get("/historico")
def listar_historico_grades(db: Session = Depends(get_db)):
    """
    Lista o histórico de todas as grades geradas.
    """
    grades = db.query(GradeDB).order_by(GradeDB.id.desc()).all()
    return [
        {
            "id": g.id,
            "nome": g.nome,
            "status": g.status,
            "ano_semestre": g.ano_semestre,
            "criado_em": g.criado_em,
            "total_aulas": g.total_aulas,
            "detalhes": g.detalhes,
        }
        for g in grades
    ]
