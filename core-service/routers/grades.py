import logging
from datetime import date
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from database.connection import SessionLocal, get_db
from database.models import AlteracaoAulaDB, AulaDB, GradeDB, ProfessorDB, SalaDB, TurmaDB
from models.grade import Aula, AulaUpdate, Grade
from services.agenda_professores import recalcular_agenda
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


def _aplicar_edicao(db: Session, aula_id: int, dados: AulaUpdate) -> AulaDB:
    """Valida e aplica a edição na sessão, sem gravar; recusa só choque com a mesma turma."""
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
    db.flush()
    recalcular_agenda(db, db.query(GradeDB).filter(GradeDB.id == aula.grade_id).first())
    return aula


@router.post("/aulas/{aula_id}/simular")
def simular_edicao(aula_id: int, dados: AulaUpdate, db: Session = Depends(get_db)):
    """
    Conflitos que a edição criaria (e os que resolveria), sem gravar nada. O frontend
    mostra os novos antes de salvar.
    """
    aula = db.query(AulaDB).filter(AulaDB.id == aula_id).first()
    if not aula:
        raise HTTPException(status_code=404, detail="Aula não encontrada")
    grade = _carregar_grade(db, aula.grade_id)
    antes = {c["id"]: c for c in DetectorConflitos(db, grade).detectar()}
    try:
        _aplicar_edicao(db, aula_id, dados)
        db.expire(grade, ["aulas"])
        depois = {c["id"]: c for c in DetectorConflitos(db, grade).detectar()}
    finally:
        db.rollback()
    return {
        "novos": [c for k, c in depois.items() if k not in antes],
        "resolvidos": [c for k, c in antes.items() if k not in depois],
    }


# Campos da aula guardados no histórico para desfazer uma edição
CAMPOS_AULA = ("dia_semana", "horario", "ordem", "professor_id", "professor_nome", "professores", "sala_nome")


def _nomes_professores(campos: dict) -> str:
    professores = campos.get("professores") or (
        [{"nome": campos["professor_nome"]}] if campos.get("professor_nome") else []
    )
    return ", ".join(p["nome"] for p in professores) or "sem professor"


def _descricao_alteracao(aula: AulaDB, antes: dict) -> Optional[str]:
    """O que mudou na aula, em uma linha; None se nada mudou."""
    depois = {c: getattr(aula, c) for c in CAMPOS_AULA}
    partes = []
    if (antes["dia_semana"], antes["horario"]) != (depois["dia_semana"], depois["horario"]):
        partes.append(f"{antes['dia_semana']} {antes['horario']} → {depois['dia_semana']} {depois['horario']}")
    if _nomes_professores(antes) != _nomes_professores(depois):
        partes.append(f"{_nomes_professores(antes)} → {_nomes_professores(depois)}")
    if (antes["sala_nome"] or None) != (depois["sala_nome"] or None):
        partes.append(f"sala {antes['sala_nome'] or 'nenhuma'} → {depois['sala_nome'] or 'nenhuma'}")
    if not partes:
        return None
    return f"{aula.disciplina_nome} ({aula.turma_nome}): " + "; ".join(partes)


@router.put("/aulas/{aula_id}", response_model=Aula)
def editar_aula(aula_id: int, dados: AulaUpdate, db: Session = Depends(get_db)):
    """
    Reatribui dia, horário, professor e sala de uma aula. Recusa apenas choque com outra
    aula da mesma turma; os demais problemas aparecem em /grades/{id}/conflitos.
    Planejamentos e janelas dos professores são refeitos a partir das aulas, e a edição
    fica no histórico da grade para poder ser desfeita.
    """
    atual = db.query(AulaDB).filter(AulaDB.id == aula_id).first()
    antes = {c: getattr(atual, c) for c in CAMPOS_AULA} if atual else None
    grade = db.get(GradeDB, atual.grade_id) if atual else None
    agenda_antes = {k: (grade.detalhes or {}).get(k, []) for k in ("planejamentos", "janelas")} if grade else None

    aula = _aplicar_edicao(db, aula_id, dados)
    descricao = _descricao_alteracao(aula, antes)
    if descricao:
        db.add(AlteracaoAulaDB(
            grade_id=aula.grade_id, aula_id=aula.id, descricao=descricao, aula_antes=antes, agenda_antes=agenda_antes,
        ))
    db.commit()
    db.refresh(aula)
    return aula


@router.get("/{grade_id}/alteracoes")
def listar_alteracoes(grade_id: int, db: Session = Depends(get_db)):
    """Edições manuais da grade, da mais recente para a mais antiga."""
    alteracoes = (
        db.query(AlteracaoAulaDB)
        .filter(AlteracaoAulaDB.grade_id == grade_id)
        .order_by(AlteracaoAulaDB.id.desc())
        .all()
    )
    return [
        {"id": a.id, "aula_id": a.aula_id, "descricao": a.descricao, "criado_em": a.criado_em} for a in alteracoes
    ]


@router.post("/{grade_id}/desfazer")
def desfazer_alteracao(grade_id: int, db: Session = Depends(get_db)):
    """
    Desfaz a última edição manual: a aula e a agenda dos professores voltam exatamente
    como estavam. As edições são desfeitas da mais recente para a mais antiga.
    """
    ultima = (
        db.query(AlteracaoAulaDB)
        .filter(AlteracaoAulaDB.grade_id == grade_id)
        .order_by(AlteracaoAulaDB.id.desc())
        .first()
    )
    if not ultima:
        raise HTTPException(status_code=404, detail="Não há alterações para desfazer nesta grade.")
    aula = db.get(AulaDB, ultima.aula_id)
    if aula:
        for campo, valor in ultima.aula_antes.items():
            setattr(aula, campo, valor)
    grade = db.get(GradeDB, grade_id)
    grade.detalhes = {**(grade.detalhes or {}), **ultima.agenda_antes}
    descricao = ultima.descricao
    db.delete(ultima)
    db.commit()
    return {"desfeita": descricao}
