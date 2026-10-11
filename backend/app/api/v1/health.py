from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ai-data-analyst",
        "version": "0.1.0",
    }