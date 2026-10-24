from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from database.connection import get_db
from database.models import AulaDB, GradeDB, ProfessorDB, SalaDB, TurmaDB
from models.grade import Aula, AulaUpdate, Grade
from services.grade_conflicts import DetectorConflitos, horarios_da_turma
from services.grid_generator import GridGeneratorService
from services.time_slots import DIAS_SEMANA, TIME_SLOTS_BY_NIVEL, slots_overlap

router = APIRouter(prefix="/grades", tags=["grades"])


def semestre_atual() -> str:
    hoje = date.today()
    return f"{hoje.year}.{1 if hoje.month <= 6 else 2}"


@router.post("/gerar-grade")
def gerar_grade(
    nome: Optional[str] = Query("Grade Horária Automática", description="Nome descritivo da grade"),
    ano_semestre: Optional[str] = Query(None, description="Ex: 2026.2 (padrão: semestre atual)"),
    db: Session = Depends(get_db),
):
    """
    Executa o algoritmo de geração automática de horários via Google OR-Tools CP-SAT.
    """
    service = GridGeneratorService(db)
    resultado = service.generate(nome_grade=nome, ano_semestre=ano_semestre or semestre_atual())
    if not resultado["sucesso"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=resultado["mensagem"],
        )
    return resultado


@router.get("/horarios")
def listar_horarios():
    """Dias letivos e horários de aula de cada nível de ensino e turno."""
    return {"dias": DIAS_SEMANA, "niveis": TIME_SLOTS_BY_NIVEL}


def _carregar_grade(db: Session, grade_id: Optional[int]) -> Optional[GradeDB]:
    query = db.query(GradeDB).options(joinedload(GradeDB.aulas))
    if grade_id:
        return query.filter(GradeDB.id == grade_id).first()
    return query.order_by(GradeDB.id.desc()).first()


@router.get("/", response_model=Grade)
def visualizar_grade(grade_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Retorna a grade horária gerada (a mais recente ou a especificada por grade_id).
    """
    grade = _carregar_grade(db, grade_id)
    if not grade:
        return Grade(
            id=0,
            nome="Nenhuma grade gerada",
            status="sem_grade",
            total_aulas=0,
            aulas=[],
        )

    resposta = Grade.model_validate(grade)
    turmas = {t.id: t for t in db.query(TurmaDB).all()}
    resposta.horarios_turmas = {tid: horarios_da_turma(turmas.get(tid)) for tid in {a.turma_id for a in grade.aulas}}
    return resposta


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


@router.get("/{grade_id}/conflitos")
def listar_conflitos(grade_id: int, db: Session = Depends(get_db)):
    """Conflitos da grade (choques, indisponibilidades) com sugestão de horário livre."""
    grade = _carregar_grade(db, grade_id)
    if not grade:
        raise HTTPException(status_code=404, detail="Grade não encontrada")
    return DetectorConflitos(db, grade).detectar()


@router.put("/aulas/{aula_id}", response_model=Aula)
def editar_aula(aula_id: int, dados: AulaUpdate, db: Session = Depends(get_db)):
    """
    Reatribui dia, horário, professor e sala de uma aula. Recusa apenas choque com outra
    aula da mesma turma; os demais problemas aparecem em /grades/{id}/conflitos.
    """
    aula = db.query(AulaDB).filter(AulaDB.id == aula_id).first()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    if dados.dia_semana not in DIAS_SEMANA:
        raise HTTPException(status_code=400, detail=f"Dia inválido: {dados.dia_semana}")
    horarios = horarios_da_turma(db.query(TurmaDB).filter(TurmaDB.id == aula.turma_id).first())
    if dados.horario not in horarios:
        raise HTTPException(status_code=400, detail=f"O horário {dados.horario} não existe na grade desta turma.")

    choque = (
        db.query(AulaDB)
        .filter(
            AulaDB.grade_id == aula.grade_id,
            AulaDB.turma_id == aula.turma_id,
            AulaDB.dia_semana == dados.dia_semana,
            AulaDB.id != aula.id,
        )
        .all()
    )
    choque = next((a for a in choque if slots_overlap(a.horario, dados.horario)), None)
    if choque:
        raise HTTPException(
            status_code=409,
            detail=f"Horário ocupado por {choque.disciplina_nome} ({choque.professor_nome or 'sem professor'}) "
            f"em {choque.dia_semana}, {choque.horario}.",
        )

    professores = []
    for professor_id in dict.fromkeys(dados.professor_ids):
        professor = db.query(ProfessorDB).filter(ProfessorDB.id == professor_id).first()
        if not professor:
            raise HTTPException(status_code=400, detail="Professor não encontrado")
        professores.append(professor)
    if dados.sala_nome and not db.query(SalaDB).filter(SalaDB.nome == dados.sala_nome).first():
        raise HTTPException(status_code=400, detail="Sala não encontrada")

    aula.dia_semana = dados.dia_semana
    aula.horario = dados.horario
    aula.ordem = horarios.index(dados.horario) + 1
    aula.professor_id = professores[0].id if professores else None
    aula.professor_nome = professores[0].nome if professores else None
    aula.professores = [{"id": p.id, "nome": p.nome} for p in professores]
    aula.sala_nome = dados.sala_nome or None
    db.commit()
    db.refresh(aula)
    return aula
