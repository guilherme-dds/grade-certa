from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.connection import get_db
from services.autenticacao import usuario_autenticado

SEGREDO = "segredo-de-teste"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", SEGREDO)
    # Tabela de usuários do auth-service (mesmo banco)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE users (email TEXT, is_active BOOLEAN)"))
        conn.execute(text("INSERT INTO users VALUES ('ana@escola.com', 1), ('bia@escola.com', 0)"))
    Session = sessionmaker(bind=engine)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI(dependencies=[Depends(usuario_autenticado)])
    app.dependency_overrides[get_db] = _db

    @app.get("/protegida")
    def protegida(email: str = Depends(usuario_autenticado)):
        return {"email": email}

    return TestClient(app)


def _token(segredo=SEGREDO, minutos=5, email="ana@escola.com", **extra):
    payload = {"sub": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutos), **extra}
    return jwt.encode(payload, segredo, algorithm="HS256")


def test_rota_exige_token_valido(client):
    assert client.get("/protegida").status_code == 401
    assert client.get("/protegida", headers={"Authorization": "Bearer lixo"}).status_code == 401
    # Assinado com outra chave ou expirado
    assert client.get("/protegida", headers={"Authorization": f"Bearer {_token('outra')}"}).status_code == 401
    assert client.get("/protegida", headers={"Authorization": f"Bearer {_token(minutos=-1)}"}).status_code == 401

    r = client.get("/protegida", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200
    assert r.json() == {"email": "ana@escola.com"}

    # Usuário desativado ou excluído perde o acesso mesmo com token válido
    assert client.get("/protegida", headers={"Authorization": f"Bearer {_token(email='bia@escola.com')}"}).status_code == 401
    assert client.get("/protegida", headers={"Authorization": f"Bearer {_token(email='eva@escola.com')}"}).status_code == 401
