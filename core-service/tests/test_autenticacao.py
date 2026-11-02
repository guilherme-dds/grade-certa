from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from services.autenticacao import usuario_autenticado

SEGREDO = "segredo-de-teste"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", SEGREDO)
    app = FastAPI(dependencies=[Depends(usuario_autenticado)])

    @app.get("/protegida")
    def protegida(email: str = Depends(usuario_autenticado)):
        return {"email": email}

    return TestClient(app)


def _token(segredo=SEGREDO, minutos=5, **extra):
    payload = {"sub": "ana@escola.com", "exp": datetime.now(timezone.utc) + timedelta(minutes=minutos), **extra}
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
