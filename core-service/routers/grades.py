import logging
from datetime import date
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from database.connection import SessionLocal, get_db
from database.models import AulaDB, GradeDB, ProfessorDB, SalaDB, TurmaDB
from models.grade import Aula, AulaUpdate, Grade
from services.grade_conflicts import DetectorConflitos, horarios_da_turma
from services.grid_generator import TEMPO_LIMITE_SEG, TEMPO_MAXIMO_SEG, GridGeneratorService
from services.time_slots import DIAS_SEMANA, TIME_SLOTS_BY_NIVEL, slots_overlap

router = APIRouter(prefix="/grades", tags=["grades"])
logger = logging.getLogger(__name__)

# Sessão usada pela geração em segundo plano (os testes trocam por uma sessão SQLite)
session_factory = SessionLocal


def semestre_atual() -> str:
    hoje = date.today()
    return f"{hoje.year}.{1 if hoje.month <= 6 else 2}"


def _resumo(g: GradeDB) -> dict:
    return {
        "id": g.id,
        "nome": g.nome,
        "status": g.status,
        "ano_semestre": g.ano_semestre,
        "criado_em": g.criado_em,
        "total_aulas": g.total_aulas,
        "detalhes": g.detalhes,
    }


def executar_geracao(grade_id: int, tempo_limite_seg: float) -> None:
    """Roda o solver fora da requisição e grava o resultado (ou o erro) na grade."""
    db = session_factory()
    try:
        grade = db.get(GradeDB, grade_id)
        GridGeneratorService(db).generate(grade=grade, tempo_limite_seg=tempo_limite_seg)
    except Exception:
        logger.exception("Falha na geração da grade %s", grade_id)
        db.rollback()
        grade = db.get(GradeDB, grade_id)
        grade.status = "erro"
        grade.detalhes = {**(grade.detalhes or {}), "mensagem": "Erro inesperado ao gerar a grade."}
        db.commit()
    finally:
        db.close()


@router.post("/gerar-grade", status_code=status.HTTP_202_ACCEPTED)
def gerar_grade(
    background_tasks: BackgroundTasks,
    nome: Optional[str] = Query("Grade Horária Automática", description="Nome descritivo da grade"),
    ano_semestre: Optional[str] = Query(None, description="Ex: 2026.2 (padrão: semestre atual)"),
    tempo_limite_seg: float = Query(TEMPO_LIMITE_SEG, ge=10, le=TEMPO_MAXIMO_SEG, description="Tempo máximo do solver"),
    db: Session = Depends(get_db),
):
    """
    Inicia a geração automática (Google OR-Tools CP-SAT) em segundo plano e devolve a
    grade com status "gerando". Acompanhe por GET /grades/{id}/status.
    """
    if db.query(GradeDB).filter(GradeDB.status == "gerando").first():
        raise HTTPException(status_code=409, detail="Já existe uma geração em andamento. Aguarde ela terminar.")
    grade = GradeDB(
        nome=nome,
        status="gerando",
        ano_semestre=ano_semestre or semestre_atual(),
        total_aulas=0,
        detalhes={"tempo_limite_seg": tempo_limite_seg},
    )
    db.add(grade)
    db.commit()
    db.refresh(grade)
    background_tasks.add_task(executar_geracao, grade.id, tempo_limite_seg)
    return _resumo(grade)


@router.delete("/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_grade(grade_id: int, db: Session = Depends(get_db)):
    """Exclui a grade e suas aulas. Uma geração em andamento não pode ser excluída."""
    grade = db.get(GradeDB, grade_id)
    if not grade:
        raise HTTPException(status_code=404, detail="Grade não encontrada")
    if grade.status == "gerando":
        raise HTTPException(status_code=409, detail="A geração desta grade ainda está em andamento.")
    db.delete(grade)
    db.commit()
    return None


@router.get("/{grade_id}/status")
def status_grade(grade_id: int, db: Session = Depends(get_db)):
    """Situação de uma geração: "gerando", "sucesso", "inviavel", "tempo_esgotado" ou "erro"."""
    grade = db.get(GradeDB, grade_id)
    if not grade:
        raise HTTPException(status_code=404, detail="Grade não encontrada")
    return _resumo(grade)


@router.get("/horarios")
def listar_horarios():
    """Dias letivos e horários de aula de cada nível de ensino e turno."""
    return {"dias": DIAS_SEMANA, "niveis": TIME_SLOTS_BY_NIVEL}


def _carregar_grade(db: Session, grade_id: Optional[int]) -> Optional[GradeDB]:
    query = db.query(GradeDB).options(joinedload(GradeDB.aulas))
    if grade_id:
        return query.filter(GradeDB.id == grade_id).first()
    # Sem id: a última grade gerada com sucesso (gerações em andamento ou que falharam ficam de fora)
    return query.filter(GradeDB.status == "sucesso").order_by(GradeDB.id.desc()).first()


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
    return [_resumo(g) for g in db.query(GradeDB).order_by(GradeDB.id.desc()).all()]


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
