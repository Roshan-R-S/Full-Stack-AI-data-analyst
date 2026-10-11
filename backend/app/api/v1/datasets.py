import io
import json
from pathlib import Path
from uuid import uuid4

import pandas as pd
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.csv_loader import load_csv
from app.core.config import (
    MAX_UPLOAD_BYTES,
    UPLOAD_DIR,
)
from app.db.session import get_db
from app.models.dataset import Dataset
from app.models.conversation import Conversation
from app.services.profiling_service import profile_dataframe

router = APIRouter(prefix="/datasets", tags=["Datasets"])


def serialize_dataset(dataset: Dataset) -> dict:
    return {
        "id": dataset.id,
        "filename": dataset.filename,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "uploaded_at": dataset.uploaded_at,
    }


def get_dataset_or_404(
    dataset_id: str,
    db: Session,
) -> Dataset:
    dataset = db.get(Dataset, dataset_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    return dataset


def read_stored_dataset(dataset_id: str) -> pd.DataFrame:
    path = UPLOAD_DIR / f"{dataset_id}.csv"

    try:
        return load_csv(path.read_bytes())
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail="Stored dataset file is missing.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="Stored CSV is invalid.",
        ) from exc


@router.post("", status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    filename = Path(file.filename or "").name

    if Path(filename).suffix.lower() != ".csv":
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported.",
        )

    if len(filename) > 255:
        raise HTTPException(
            status_code=400,
            detail="Filename is too long.",
        )

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="CSV exceeds the 10 MB upload limit.",
        )

    try:
        df = load_csv(content)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    dataset_id = str(uuid4())
    path = UPLOAD_DIR / f"{dataset_id}.csv"

    dataset = Dataset(
        id=dataset_id,
        filename=filename,
        row_count=len(df),
        column_count=len(df.columns),
    )

    try:
        path.write_bytes(content)
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise

    return serialize_dataset(dataset)


@router.get("")
def list_datasets(db: Session = Depends(get_db)):
    results = db.scalars(
        select(Dataset).order_by(
            Dataset.uploaded_at.desc()
        )
    ).all()

    return [serialize_dataset(d) for d in results]


@router.get("/{dataset_id}")
def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    return serialize_dataset(
        get_dataset_or_404(dataset_id, db)
    )


@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    get_dataset_or_404(dataset_id, db)
    df = read_stored_dataset(dataset_id)

    start = (page - 1) * page_size
    subset = df.iloc[start:start + page_size]

    rows = json.loads(
        subset.to_json(
            orient="records",
            date_format="iso",
        )
    )

    return {
        "dataset_id": dataset_id,
        "page": page,
        "page_size": page_size,
        "total_rows": len(df),
        "columns": [str(c) for c in df.columns],
        "rows": rows,
    }


@router.get("/{dataset_id}/profile")
def get_profile(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    get_dataset_or_404(dataset_id, db)
    df = read_stored_dataset(dataset_id)

    return {
        "dataset_id": dataset_id,
        **profile_dataframe(df),
    }


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
):
    dataset = get_dataset_or_404(dataset_id, db)

    conversations = db.scalars(
        select(Conversation).where(
            Conversation.dataset_id == dataset_id
        )
    ).all()

    for conversation in conversations:
        db.delete(conversation)

    db.delete(dataset)
    db.commit()

    path = UPLOAD_DIR / f"{dataset_id}.csv"
    path.unlink(missing_ok=True)

    return Response(status_code=204)