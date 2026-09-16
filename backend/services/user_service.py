from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.core.security import get_password_hash
from backend.models.user import User
from backend.schemas.user import UserCreate


class UserService:
    @staticmethod
    def create_user(db: Session, user_in: UserCreate) -> User:
        db_user = db.query(User).filter(User.email == user_in.email).first()
        if db_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email já cadastrado."
            )

        hashed_pw = get_password_hash(user_in.password)
        new_user = User(
            name=user_in.name,
            email=user_in.email,
            hashed_password=hashed_pw
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user
