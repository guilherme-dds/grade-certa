from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.models.user import User
from backend.schemas.auth import TokenResponse
from backend.schemas.user import UserResponse
from backend.services.auth_service import AuthService

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
