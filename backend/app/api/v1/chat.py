import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.client import get_gemini_client, get_model_name
from app.ai.explainer import explain_results
from app.ai.planner import compile_ai_plan, plan_question
from app.analytics.executor import execute_analysis
from app.api.v1.datasets import (
    get_dataset_or_404,
    read_stored_dataset,
)
from app.db.session import get_db
from app.schemas.chat import AskRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["AI Analyst"])


@router.post("/ask")
def ask_ai(
    request: AskRequest,
    db: Session = Depends(get_db),
):
    dataset_id = str(request.dataset_id)

    get_dataset_or_404(dataset_id, db)
    df = read_stored_dataset(dataset_id)

    try:
        client = get_gemini_client()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured.",
        ) from exc

    model = get_model_name()

    try:
        ai_plan = plan_question(
            client, model, request.question, df
        )
    except Exception as exc:
        logger.warning(
            "Gemini planning failed: %s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini planning failed. "
                "Check model access, API key and quota."
            ),
        ) from exc

    try:
        plan = compile_ai_plan(
            ai_plan, request.dataset_id, df
        )
        analysis = execute_analysis(df, plan)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    try:
        explanation = explain_results(
            client, model, request.question, analysis
        )
    except Exception as exc:
        logger.warning(
            "Gemini explanation failed: %s",
            type(exc).__name__,
        )
        explanation = (
            "The calculation completed successfully, "
            "but the AI explanation is unavailable. "
            "Review the verified results table."
        )

    return {
        "question": request.question,
        "model": model,
        "answer": explanation,
        "plan": plan.model_dump(mode="json"),
        "analysis": analysis,
    }