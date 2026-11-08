"""
Exige nas rotas do core-service o token emitido pelo auth-service no login.
Os dois serviços assinam e validam o token com a mesma SECRET_KEY (arquivo .env), e o
usuário do token precisa continuar ativo na tabela `users` do auth-service (mesmo banco):
desativar ou excluir alguém corta o acesso na hora, sem esperar o token expirar.
"""
import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.connection import get_db

_bearer = HTTPBearer(auto_error=False)


def usuario_autenticado(
    credenciais: HTTPAuthorizationCredentials | None = Depends(_bearer), db: Session = Depends(get_db)
) -> str:
    """E-mail do usuário logado; 401 sem token, com token inválido/expirado ou usuário inativo."""
    nao_autorizado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Faça login para continuar.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credenciais is None:
        raise nao_autorizado
    try:
        payload = jwt.decode(
            credenciais.credentials,
            os.environ["SECRET_KEY"],
            algorithms=[os.getenv("ALGORITHM", "HS256")],
        )
    except jwt.PyJWTError:
        raise nao_autorizado
    email = payload.get("sub")
    if not email:
        raise nao_autorizado
    ativo = db.execute(text("SELECT is_active FROM users WHERE email = :email"), {"email": email}).scalar()
    if not ativo:
        raise nao_autorizado
    return email
