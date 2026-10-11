from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.analytics.executor import execute_analysis
from app.api.v1.datasets import (
    get_dataset_or_404,
    read_stored_dataset,
)
from app.db.session import get_db
from app.schemas.analysis import AnalysisRequest


router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"],
)


@router.post("")
def run_analysis(
    request: AnalysisRequest,
    db: Session = Depends(get_db),
):
    dataset_id = str(request.dataset_id)

    get_dataset_or_404(dataset_id, db)

    df = read_stored_dataset(dataset_id)

    try:
        return execute_analysis(df, request)

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc