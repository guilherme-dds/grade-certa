from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.schemas.user import UserCreate, UserResponse
from backend.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    return UserService.create_user(db, user_in)
