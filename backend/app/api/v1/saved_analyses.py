import json
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.executor import execute_analysis
from app.analytics.plan_validator import validate_analysis_plan
from app.api.v1.datasets import (
    get_dataset_or_404,
    read_stored_dataset,
)
from app.db.session import get_db
from app.models.saved_analysis import SavedAnalysis, utc_now
from app.schemas.analysis import AnalysisRequest
from app.schemas.saved_analysis import (
    RenameSavedAnalysis,
    SaveAnalysisRequest,
)

router = APIRouter(
    prefix="/saved-analyses",
    tags=["Saved Analyses"],
)


def get_saved_or_404(
    analysis_id: UUID, db: Session
) -> SavedAnalysis:
    item = db.get(SavedAnalysis, str(analysis_id))

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Saved analysis not found.",
        )

    return item


def clean_name(name: str) -> str:
    cleaned = name.strip()

    if not cleaned:
        raise HTTPException(
            status_code=422,
            detail="Analysis name cannot be empty.",
        )

    return cleaned


def check_plan(
    plan: AnalysisRequest, db: Session
) -> None:
    dataset_id = str(plan.dataset_id)

    get_dataset_or_404(dataset_id, db)
    dataframe = read_stored_dataset(dataset_id)

    try:
        validate_analysis_plan(dataframe, plan)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc


def summary(item: SavedAnalysis) -> dict:
    return {
        "id": item.id,
        "dataset_id": item.dataset_id,
        "name": item.name,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def detail(item: SavedAnalysis) -> dict:
    return {
        **summary(item),
        "plan": json.loads(item.plan_json),
    }


@router.post("", status_code=201)
def save_analysis(
    request: SaveAnalysisRequest,
    db: Session = Depends(get_db),
):
    check_plan(request.plan, db)

    item = SavedAnalysis(
        id=str(uuid4()),
        dataset_id=str(request.plan.dataset_id),
        name=clean_name(request.name),
        plan_json=request.plan.model_dump_json(),
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return detail(item)


@router.get("")
def list_saved_analyses(
    dataset_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    statement = select(SavedAnalysis)

    if dataset_id is not None:
        statement = statement.where(
            SavedAnalysis.dataset_id == str(dataset_id)
        )

    statement = statement.order_by(
        SavedAnalysis.updated_at.desc(),
        SavedAnalysis.id.desc(),
    ).limit(100)

    items = db.scalars(statement).all()

    return [summary(item) for item in items]


@router.get("/{analysis_id}")
def get_saved_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    return detail(get_saved_or_404(analysis_id, db))


@router.patch("/{analysis_id}")
def rename_saved_analysis(
    analysis_id: UUID,
    request: RenameSavedAnalysis,
    db: Session = Depends(get_db),
):
    item = get_saved_or_404(analysis_id, db)

    item.name = clean_name(request.name)
    item.updated_at = utc_now()

    db.commit()
    db.refresh(item)

    return detail(item)


@router.put("/{analysis_id}/plan")
def update_saved_plan(
    analysis_id: UUID,
    plan: AnalysisRequest,
    db: Session = Depends(get_db),
):
    item = get_saved_or_404(analysis_id, db)

    if str(plan.dataset_id) != item.dataset_id:
        raise HTTPException(
            status_code=422,
            detail="A saved analysis cannot change its dataset.",
        )

    check_plan(plan, db)

    item.plan_json = plan.model_dump_json()
    item.updated_at = utc_now()

    db.commit()
    db.refresh(item)

    return detail(item)


@router.post("/{analysis_id}/run")
def rerun_saved_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    item = get_saved_or_404(analysis_id, db)

    get_dataset_or_404(item.dataset_id, db)

    plan = AnalysisRequest.model_validate_json(
        item.plan_json
    )

    dataframe = read_stored_dataset(item.dataset_id)

    try:
        result = execute_analysis(dataframe, plan)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    return {
        "saved_analysis_id": item.id,
        "plan": plan.model_dump(mode="json"),
        "analysis": result,
    }


@router.delete("/{analysis_id}", status_code=204)
def delete_saved_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
):
    item = get_saved_or_404(analysis_id, db)

    db.delete(item)
    db.commit()

    return Response(status_code=204)