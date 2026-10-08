from sqlalchemy import Column, Integer, String, Boolean, JSON
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


class DisponibilidadeDB(Base):
    __tablename__ = "disponibilidades"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    professor_id = Column(Integer, nullable=False)
    dia_semana = Column(String(50), nullable=False)
    horario_inicio = Column(String(50), nullable=False)
    horario_fim = Column(String(50), nullable=False)
