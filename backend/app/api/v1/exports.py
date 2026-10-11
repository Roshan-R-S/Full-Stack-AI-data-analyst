import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.analytics.executor import execute_analysis
from app.api.v1.datasets import (
    get_dataset_or_404,
    read_stored_dataset,
)
from app.db.session import get_db
from app.schemas.analysis import AnalysisRequest
from app.services.pdf_report import build_pdf_report

router = APIRouter(prefix="/exports", tags=["Exports"])


def safe_csv_cell(value):
    if value is None:
        return ""

    if isinstance(value, str):
        candidate = value.lstrip(" \t\r\n")

        if (
            value.startswith(("\t", "\r", "\n"))
            or candidate.startswith(("=", "+", "-", "@"))
        ):
            return "'" + value

    return value


@router.post("/analysis/csv")
def export_analysis_csv(
    request: AnalysisRequest,
    db: Session = Depends(get_db),
):
    dataset_id = str(request.dataset_id)

    get_dataset_or_404(dataset_id, db)
    dataframe = read_stored_dataset(dataset_id)

    try:
        analysis = execute_analysis(dataframe, request)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")

    columns = analysis["columns"]

    writer.writerow([
        safe_csv_cell(column) for column in columns
    ])

    for row in analysis["rows"]:
        writer.writerow([
            safe_csv_cell(row.get(column))
            for column in columns
        ])

    content = output.getvalue().encode("utf-8-sig")

    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition":
                f'attachment; filename="analysis-{dataset_id[:8]}.csv"',
            "X-Export-Truncated":
                str(analysis["truncated"]).lower(),
        },
    )

@router.post("/analysis/pdf")
def export_analysis_pdf(
    request: AnalysisRequest,
    db: Session = Depends(get_db),
):
    dataset_id = str(request.dataset_id)

    dataset = get_dataset_or_404(dataset_id, db)
    dataframe = read_stored_dataset(dataset_id)

    try:
        analysis = execute_analysis(dataframe, request)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    pdf_bytes = build_pdf_report(
        analysis,
        request,
        dataset.filename,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f'attachment; filename="report-{dataset_id[:8]}.pdf"',
            "X-Export-Truncated":
                str(analysis["truncated"]).lower(),
        },
    )