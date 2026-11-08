from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from core.security import decode_access_token, get_password_hash, verify_password
from database.connection import get_db
from models.user import User
from schemas.user import PasswordChange, UserCreate, UserResponse, UserUpdate
from services.auth_service import AuthService
from services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])

# Token opcional: só o primeiro usuário do sistema se cadastra sem login
token_opcional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _usuario_logado(db: Session, token: str | None) -> User | None:
    payload = decode_access_token(token) if token else None
    email = payload.get("sub") if payload else None
    user = db.query(User).filter(User.email == email).first() if email else None
    return user if user and user.is_active else None


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), token: str | None = Depends(token_opcional)):
    # Depois do primeiro usuário, só quem já tem conta cria outras
    if db.query(User).first() and not _usuario_logado(db, token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="O cadastro é feito por quem já tem acesso ao sistema. Peça a um usuário para criar sua conta.",
        )
    return UserService.create_user(db, user_in)


@router.get("/", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), _: User = Depends(AuthService.get_current_user)):
    return db.query(User).order_by(User.name).all()


@router.put("/me/senha", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    dados: PasswordChange, db: Session = Depends(get_db), atual: User = Depends(AuthService.get_current_user)
):
    """Troca a senha de quem está logado, confirmando a senha atual."""
    if not verify_password(dados.senha_atual, atual.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A senha atual está incorreta.")
    atual.hashed_password = get_password_hash(dados.nova_senha)
    db.commit()
    return None


def _outro_usuario(db: Session, user_id: int, atual: User, acao: str) -> User:
    """O usuário alvo; ninguém altera a própria conta (assim sempre sobra alguém ativo)."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    if user.id == atual.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Você não pode {acao} a própria conta. Peça a outro usuário.",
        )
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    dados: UserUpdate,
    db: Session = Depends(get_db),
    atual: User = Depends(AuthService.get_current_user),
):
    """Ativa ou desativa uma conta; desativada, ela não entra mais nem usa o sistema."""
    user = _outro_usuario(db, user_id, atual, "desativar" if not dados.is_active else "alterar")
    user.is_active = dados.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), atual: User = Depends(AuthService.get_current_user)):
    db.delete(_outro_usuario(db, user_id, atual, "excluir"))
    db.commit()
    return None
