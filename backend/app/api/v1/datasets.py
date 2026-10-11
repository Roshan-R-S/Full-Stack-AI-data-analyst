import json
import logging
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
from app.models.conversation import Conversation
from app.models.dataset import Dataset
from app.models.saved_analysis import SavedAnalysis
from app.services.profiling_service import profile_dataframe

logger = logging.getLogger(__name__)

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
    except OSError as exc:
        logger.exception(
            "Stored dataset read failed: %s", dataset_id
        )
        raise HTTPException(
            status_code=503,
            detail="Stored dataset could not be read.",
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
    except OSError as exc:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.exception(
                "Upload file cleanup failed: %s", dataset_id
            )

        logger.exception(
            "Upload file write failed: %s", dataset_id
        )
        raise HTTPException(
            status_code=503,
            detail="Could not store the uploaded file.",
        ) from exc

    try:
        db.add(dataset)
        db.commit()
    except Exception as exc:
        db.rollback()

        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.exception(
                "Failed to clean up dataset file: %s",
                dataset_id,
            )

        logger.exception(
            "Dataset metadata save failed: %s", dataset_id
        )
        raise HTTPException(
            status_code=503,
            detail="Could not save dataset metadata.",
        ) from exc

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

    path = UPLOAD_DIR / f"{dataset_id}.csv"
    staged_path = None

    # Move the CSV out of its active location first.
    # A failed rename leaves the database untouched.
    try:
        if path.exists():
            staged_path = path.with_name(
                f".{dataset_id}.{uuid4().hex}.deleting"
            )
            path.replace(staged_path)
    except OSError as exc:
        logger.exception(
            "Dataset delete staging failed: %s", dataset_id
        )
        raise HTTPException(
            status_code=503,
            detail="Could not prepare dataset deletion.",
        ) from exc

    try:
        conversations = db.scalars(
            select(Conversation).where(
                Conversation.dataset_id == dataset_id
            )
        ).all()

        for conversation in conversations:
            db.delete(conversation)

        saved_analyses = db.scalars(
            select(SavedAnalysis).where(
                SavedAnalysis.dataset_id == dataset_id
            )
        ).all()

        for item in saved_analyses:
            db.delete(item)

        db.delete(dataset)
        db.commit()

    except Exception as exc:
        db.rollback()

        # Restore the active CSV if SQLite could not commit.
        if staged_path is not None:
            try:
                staged_path.replace(path)
            except OSError as restore_exc:
                logger.exception(
                    "CRITICAL: Dataset file restoration "
                    "failed for %s; staged file: %s",
                    dataset_id,
                    staged_path,
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Dataset deletion failed. "
                        "Manual file recovery may be required."
                    ),
                ) from restore_exc

        logger.exception(
            "Dataset database deletion failed: %s",
            dataset_id,
        )

        raise HTTPException(
            status_code=503,
            detail="Could not delete dataset. Please retry.",
        ) from exc

    # Once SQLite has committed, never restore the active CSV:
    # the metadata and dependent records are already deleted.
    if staged_path is not None:
        try:
            staged_path.unlink()
        except OSError:
            logger.warning(
                "Dataset %s was deleted, but staged file "
                "cleanup is pending: %s",
                dataset_id,
                staged_path,
                exc_info=True,
            )

    return Response(status_code=204)