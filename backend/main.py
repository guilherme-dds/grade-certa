from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database.connection import Base, engine
from backend.routes.auth import router as auth_router
from backend.routes.users import router as users_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Grade Certa API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)


@app.get("/")
def read_root():
    return {"message": "API Grade Certa funcionando"}
