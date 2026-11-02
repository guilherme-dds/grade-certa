from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from core.security import decode_access_token
from database.connection import get_db
from models.user import User
from schemas.user import UserCreate, UserResponse
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
