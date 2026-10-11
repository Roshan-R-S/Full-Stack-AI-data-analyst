from datetime import UTC, datetime
from html import escape
from io import BytesIO
from pathlib import Path

import reportlab
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas.analysis import AnalysisRequest

BLACK = colors.HexColor("#171717")
RED = colors.HexColor("#D71921")
GREY = colors.HexColor("#666666")
PALE = colors.HexColor("#F1F1F1")


def register_fonts():
    folder = Path(reportlab.__file__).parent / "fonts"

    if "AnalystVera" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(
            TTFont("AnalystVera", str(folder / "Vera.ttf"))
        )
        pdfmetrics.registerFont(
            TTFont("AnalystVeraBold", str(folder / "VeraBd.ttf"))
        )


def paragraph(value, style, max_chars=180):
    text = str(value)

    if len(text) > max_chars:
        text = text[:max_chars - 3] + "..."

    return Paragraph(
        escape(text).replace("\n", "<br/>"),
        style,
    )


def page_decoration(canvas, doc):
    canvas.saveState()
    width, height = landscape(A4)

    canvas.setFillColor(RED)
    canvas.rect(38, height - 34, 7, 7, fill=1, stroke=0)

    canvas.setFillColor(BLACK)
    canvas.setFont("AnalystVeraBold", 9)
    canvas.drawString(52, height - 34, "DATA / ANALYST")

    canvas.setStrokeColor(colors.HexColor("#DDDDDD"))
    canvas.line(38, height - 43, width - 38, height - 43)

    canvas.setFillColor(GREY)
    canvas.setFont("AnalystVera", 8)
    canvas.drawString(38, 25, "VERIFIED / PANDAS")
    canvas.drawRightString(
        width - 38, 25, f"PAGE {doc.page}"
    )

    canvas.restoreState()


def build_pdf_report(
    analysis: dict,
    plan: AnalysisRequest,
    dataset_filename: str,
) -> bytes:
    register_fonts()

    params = plan.model_dump(mode="json")
    output = BytesIO()

    doc = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        leftMargin=38,
        rightMargin=38,
        topMargin=59,
        bottomMargin=46,
        title="Verified Analysis Report",
        author="DATA / ANALYST",
    )

    title_style = ParagraphStyle(
        "ReportTitle",
        fontName="AnalystVeraBold",
        fontSize=22,
        leading=29,
        textColor=BLACK,
        spaceAfter=16,
    )

    heading = ParagraphStyle(
        "ReportHeading",
        fontName="AnalystVeraBold",
        fontSize=12,
        leading=16,
        textColor=BLACK,
        spaceBefore=13,
        spaceAfter=8,
    )

    normal = ParagraphStyle(
        "ReportNormal",
        fontName="AnalystVera",
        fontSize=9,
        leading=13,
        textColor=BLACK,
        splitLongWords=True,
    )

    small = ParagraphStyle(
        "ReportSmall",
        parent=normal,
        fontSize=8,
        leading=11,
        textColor=GREY,
    )

    table_header = ParagraphStyle(
        "ReportTableHeader",
        parent=normal,
        fontName="AnalystVeraBold",
        fontSize=8,
        textColor=colors.white,
    )

    story = [
        Paragraph("VERIFIED ANALYSIS REPORT", title_style),
        paragraph(f"Dataset: {dataset_filename}", normal),
        paragraph(
            "Generated UTC: " +
            datetime.now(UTC).strftime(
                "%Y-%m-%d %H:%M UTC"
            ),
            small,
        ),
        Spacer(1, 18),
    ]

    kpis = [
        ["SOURCE ROWS", "MATCHED ROWS", "RESULT GROUPS"],
        [
            str(analysis["source_rows"]),
            str(analysis["matched_rows"]),
            str(analysis["result_count"]),
        ],
    ]

    kpi_table = Table(
        kpis,
        colWidths=[doc.width / 3] * 3,
        rowHeights=[26, 40],
    )

    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("FONTNAME", (0, 0), (-1, 0), "AnalystVera"),
        ("FONTNAME", (0, 1), (-1, 1), "AnalystVeraBold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, 1), 18),
        ("TEXTCOLOR", (0, 0), (-1, 0), GREY),
        ("TEXTCOLOR", (0, 1), (-1, 1), BLACK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
    ]))

    story.extend([
        kpi_table,
        Spacer(1, 18),
        Paragraph("CONFIGURATION", heading),
    ])

    metrics = ", ".join(
        f"{item['aggregation'].upper()} "
        f"{item['column']} AS {item['alias']}"
        for item in params["metrics"]
    )

    grouping = ", ".join(params["group_by"]) or "None"

    filters = "; ".join(
        f"{item['column']} {item['operator']} "
        f"{item['value']}"
        for item in params["filters"]
    ) or "None"

    sort = params.get("sort")
    sorting = (
        f"{sort['column']} / {sort['direction'].upper()}"
        if sort else "None"
    )

    story.extend([
        paragraph("Metrics: " + metrics, normal),
        paragraph("Grouping: " + grouping, normal),
        paragraph("Filters: " + filters, normal),
        paragraph("Sort: " + sorting, normal),
        paragraph(f"Result limit: {plan.limit}", normal),
    ])

    # Create a bar chart for the first five returned groups
    # when the leading metric has nonnegative numeric results.
    if params["group_by"] and analysis["rows"]:
        metric_key = params["metrics"][0]["alias"]
        chart_data = []

        for row in analysis["rows"][:5]:
            value = row.get(metric_key)

            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or value < 0
            ):
                chart_data = []
                break

            label = " / ".join(
                str(row.get(column, ""))
                for column in params["group_by"]
            )

            chart_data.append((label, float(value)))

        if chart_data:
            story.append(
                Paragraph("RESULT SAMPLE / FIRST FIVE GROUPS", heading)
            )

            drawing = Drawing(
                doc.width,
                25 + len(chart_data) * 22,
            )

            maximum = max(
                (value for _, value in chart_data),
                default=1,
            ) or 1

            for index, (label, value) in enumerate(chart_data):
                y = 15 + (
                    len(chart_data) - index - 1
                ) * 22

                drawing.add(String(
                    0, y, label[:23],
                    fontName="AnalystVera",
                    fontSize=8,
                ))

                drawing.add(Rect(
                    185, y - 1,
                    400 * (value / maximum),
                    11,
                    fillColor=RED,
                    strokeColor=None,
                ))

                drawing.add(String(
                    597, y, f"{value:,.2f}",
                    fontName="AnalystVera",
                    fontSize=8,
                ))

            story.append(drawing)

    story.append(
        Paragraph("VERIFIED RESULT TABLE", heading)
    )

    columns = analysis["columns"]

    table_data = [[
        paragraph(column, table_header)
        for column in columns
    ]]

    for row in analysis["rows"]:
        table_data.append([
            paragraph(
                "" if row.get(column) is None
                else row.get(column),
                normal,
            )
            for column in columns
        ])

    result_table = Table(
        table_data,
        colWidths=[doc.width / len(columns)] * len(columns),
        repeatRows=1,
        hAlign="LEFT",
    )

    result_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLACK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, PALE]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, RED),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    story.append(result_table)
    story.append(Spacer(1, 12))

    note = (
        f"Returned {analysis['returned_rows']} of "
        f"{analysis['result_count']} result groups. "
    )

    if analysis["truncated"]:
        note += "The analytical result limit was applied."
    else:
        note += "The analytical results were not truncated."

    story.append(paragraph(note, small))
    story.append(paragraph(
        "This report contains verified aggregate results, "
        "not the original dataset. Very long table cells "
        "are shortened for PDF readability.",
        small,
    ))

    doc.build(
        story,
        onFirstPage=page_decoration,
        onLaterPages=page_decoration,
    )

    return output.getvalue()