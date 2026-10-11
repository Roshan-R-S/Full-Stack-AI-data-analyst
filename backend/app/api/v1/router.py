from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.datasets import router as dataset_router
from app.api.v1.analysis import router as analysis_router
from app.api.v1.chat import router as chat_router
from app.api.v1.conversations import router as conversations_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(dataset_router)
api_router.include_router(analysis_router)
api_router.include_router(chat_router)
api_router.include_router(conversations_router)