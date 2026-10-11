from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.router import api_router
from app.db.session import Base, engine
from app.models.dataset import Dataset  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Full Stack AI Data Analyst",
    version="0.2.0",
    description="AI-powered data analytics API",
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api/v1")