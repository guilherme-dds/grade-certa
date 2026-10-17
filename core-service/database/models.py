from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database.connection import Base

class DisciplinaDB(Base):
    __tablename__ = "disciplinas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nome = Column(String(255), nullable=False)
    quantidade_aulas = Column(Integer, default=4)


class ProfessorDB(Base):
    __tablename__ = "professores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    niveis_ensino = Column(JSON, default=list)
    disciplinas = Column(JSON, default=list)
    carga_maxima_aulas = Column(Integer, default=20)
    ativo = Column(Boolean, default=True)


class TurmaDB(Base):
    __tablename__ = "turmas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nome = Column(String(255), nullable=False)
    turno = Column(String(100), nullable=False)
    nivel_ensino = Column(String(100), nullable=True, default="Anos Finais")
    matriz_curricular = Column(JSON, default=list)


class DisponibilidadeDB(Base):
    __tablename__ = "disponibilidades"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    professor_id = Column(Integer, nullable=False)
    dia_semana = Column(String(50), nullable=False)
    horario_inicio = Column(String(50), nullable=False)
    horario_fim = Column(String(50), nullable=False)


class GradeDB(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nome = Column(String(255), default="Grade Horária Automática")
    status = Column(String(50), default="concluida")  # "gerando", "sucesso", "inviavel", "erro"
    ano_semestre = Column(String(50), default="2026.2")
    criado_em = Column(DateTime, server_default=func.now())
    total_aulas = Column(Integer, default=0)
    detalhes = Column(JSON, default=dict)

    aulas = relationship("AulaDB", back_populates="grade", cascade="all, delete-orphan")


class AulaDB(Base):
    __tablename__ = "aulas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    grade_id = Column(Integer, ForeignKey("grades.id", ondelete="CASCADE"), nullable=False, index=True)
    turma_id = Column(Integer, nullable=False, index=True)
    turma_nome = Column(String(100), nullable=False)
    disciplina_nome = Column(String(100), nullable=False)
    professor_id = Column(Integer, nullable=True, index=True)
    professor_nome = Column(String(255), nullable=True)
    sala_nome = Column(String(100), nullable=True)
    dia_semana = Column(String(20), nullable=False)
    horario = Column(String(50), nullable=False)
    ordem = Column(Integer, default=1)

    grade = relationship("GradeDB", back_populates="aulas")
