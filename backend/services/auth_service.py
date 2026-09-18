from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.core.security import create_access_token, decode_access_token, verify_password
from backend.database.connection import get_db
from backend.models.user import User
from backend.schemas.auth import TokenPayload, TokenResponse

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class AuthService:
    @staticmethod
    async def extract_credentials(request: Request) -> tuple[str, str]:
        content_type = request.headers.get("content-type", "")
        email = None
        password = None

        if "application/json" in content_type:
            try:
                body = await request.json()
                email = body.get("email") or body.get("username")
                password = body.get("password")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Formato JSON inválido."
                )
        else:
            try:
                form = await request.form()
                email = form.get("email") or form.get("username")
                password = form.get("password")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Formato de requisição inválido."
                )

        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="É necessário fornecer e-mail e senha."
            )

        return email, password

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> User:
        user = db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail ou senha incorretos.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário inativo."
            )

        return user

    @staticmethod
    def create_user_token(user: User) -> TokenResponse:
        access_token = create_access_token(data={"sub": user.email})
        return TokenResponse(access_token=access_token, token_type="bearer")

    @classmethod
    def login(cls, db: Session, email: str, password: str) -> TokenResponse:
        user = cls.authenticate_user(db, email=email, password=password)
        return cls.create_user_token(user)

    @staticmethod
    def get_current_user(
        db: Session = Depends(get_db),
        token: str = Depends(oauth2_scheme)
    ) -> User:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível validar as credenciais.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        payload = decode_access_token(token)
        if payload is None:
            raise credentials_exception

        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception

        token_data = TokenPayload(sub=email)

        user = db.query(User).filter(User.email == token_data.sub).first()
        if user is None:
            raise credentials_exception

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário inativo."
            )

        return user
