import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.connection import Base, get_db
from routes.auth import router as auth_router
from routes.users import router as users_router

SENHA = "senha-de-teste"


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(users_router)
    app.dependency_overrides[get_db] = _db
    return TestClient(app)


def _criar(client, nome, headers=None):
    r = client.post("/users/", json={"name": nome, "email": f"{nome.lower()}@escola.com", "password": SENHA},
                    headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _login(client, nome):
    r = client.post("/auth/login", json={"email": f"{nome.lower()}@escola.com", "password": SENHA})
    return r


def _headers(client, nome):
    return {"Authorization": f"Bearer {_login(client, nome).json()['access_token']}"}


def test_listar_desativar_reativar_e_excluir(client):
    ana = _criar(client, "Ana")
    h = _headers(client, "Ana")
    bia = _criar(client, "Bia", h)

    assert client.get("/users/").status_code == 401
    assert [u["name"] for u in client.get("/users/", headers=h).json()] == ["Ana", "Bia"]

    # Desativada, a Bia não entra
    assert client.patch(f"/users/{bia['id']}", json={"is_active": False}, headers=h).json()["is_active"] is False
    assert _login(client, "Bia").status_code == 400
    client.patch(f"/users/{bia['id']}", json={"is_active": True}, headers=h)
    assert _login(client, "Bia").status_code == 200

    assert client.delete(f"/users/{bia['id']}", headers=h).status_code == 204
    assert [u["name"] for u in client.get("/users/", headers=h).json()] == ["Ana"]
    assert client.delete(f"/users/{bia['id']}", headers=h).status_code == 404


def test_ninguem_desativa_nem_exclui_a_propria_conta(client):
    ana = _criar(client, "Ana")
    h = _headers(client, "Ana")
    r = client.patch(f"/users/{ana['id']}", json={"is_active": False}, headers=h)
    assert r.status_code == 400 and "própria conta" in r.json()["detail"]
    assert client.delete(f"/users/{ana['id']}", headers=h).status_code == 400


def test_trocar_a_propria_senha(client):
    _criar(client, "Ana")
    h = _headers(client, "Ana")
    assert client.put("/users/me/senha", json={"senha_atual": SENHA, "nova_senha": "nova-senha"}).status_code == 401

    r = client.put("/users/me/senha", json={"senha_atual": "errada", "nova_senha": "nova-senha"}, headers=h)
    assert r.status_code == 400 and r.json()["detail"] == "A senha atual está incorreta."
    assert client.put("/users/me/senha", json={"senha_atual": SENHA, "nova_senha": "curta"}, headers=h).status_code == 422

    assert client.put("/users/me/senha", json={"senha_atual": SENHA, "nova_senha": "nova-senha"}, headers=h).status_code == 204
    assert _login(client, "Ana").status_code == 401
    r = client.post("/auth/login", json={"email": "ana@escola.com", "password": "nova-senha"})
    assert r.status_code == 200
