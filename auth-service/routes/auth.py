from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from database.connection import get_db
from models.user import User
from schemas.auth import TokenResponse
from schemas.user import UserResponse
from services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    email, password = await AuthService.extract_credentials(request)
    return AuthService.login(db, email=email, password=password)


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(AuthService.get_current_user)):
    return current_user
