from fastapi import FastAPI
from backend.database.connection import Base, engine
from backend.routes.users import router as users_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Grade Certa API",
    version="1.0.0"
)

app.include_router(users_router)


@app.get("/")
def read_root():
    return {"message": "API Grade Certa funcionando"}
