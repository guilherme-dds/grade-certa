"""
Exige nas rotas do core-service o token emitido pelo auth-service no login.
Os dois serviços assinam e validam o token com a mesma SECRET_KEY (arquivo .env).
"""
import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


def usuario_autenticado(credenciais: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    """E-mail do usuário logado; 401 sem token ou com token inválido/expirado."""
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
    return email
