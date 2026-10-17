import io
import math
import re
from datetime import datetime

import xlsxwriter

from app.schemas.analysis import AnalysisRequest

COLORS = [
    "#D71921", "#F97316", "#EAB308", "#84CC16",
    "#10B981", "#06B6D4", "#3B82F6", "#6366F1",
    "#A855F7", "#EC4899", "#14B8A6", "#D97706",
]


def _sort_key(label):
    try:
        return float(label)
    except (TypeError, ValueError):
        pass

    try:
        return datetime.fromisoformat(
            str(label)
        ).timestamp()
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(
            "Line and area charts require ordered dates or numbers."
        ) from exc


def _chart_points(analysis, plan, chart_type, metric_alias):
    if len(plan.group_by) != 1:
        raise ValueError("Chart export requires one grouping column.")

    group = plan.group_by[0]
    metric = next(
        (m for m in plan.metrics if m.alias == metric_alias),
        None,
    )

    if (
        metric is None
        or group not in analysis["columns"]
        or metric_alias not in analysis["columns"]
    ):
        raise ValueError("Invalid chart metric or grouping column.")

    points = []

    for row in analysis["rows"]:
        value = row.get(metric_alias)

        if (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and math.isfinite(value)
        ):
            label = row.get(group)
            points.append((
                str(label) if label is not None else "UNKNOWN",
                float(value),
            ))

    if not points:
        raise ValueError("No numeric chart results available.")

    if chart_type in ("pie", "donut"):
        complete = (
            not analysis["truncated"]
            and analysis["returned_rows"] == analysis["result_count"]
        )

        if (
            not complete
            or metric.aggregation not in ("sum", "count")
            or len(points) < 2
            or any(value < 0 for _, value in points)
            or not any(value > 0 for _, value in points)
        ):
            raise ValueError(
                "Pie and donut charts require complete, "
                "nonnegative additive results."
            )

        points.sort(key=lambda point: point[1], reverse=True)

        if len(points) > 12:
            others = points[11:]
            points = [
                *points[:11],
                (
                    f"Other ({len(others)} categories)",
                    sum(value for _, value in others),
                ),
            ]

    if chart_type in ("line", "area"):
        if not re.search(
            r"date|year|month|week|day|period|^age$",
            group,
            re.IGNORECASE,
        ):
            raise ValueError(
                "Line and area charts require a time or ordered axis."
            )

        points.sort(key=lambda point: _sort_key(point[0]))

    return group, metric, points


def _write_cell(sheet, row, column, value, number_format):
    if value is None:
        sheet.write_blank(row, column, None)
    elif isinstance(value, bool):
        sheet.write_boolean(row, column, value)
    elif (
        isinstance(value, (int, float))
        and math.isfinite(value)
    ):
        sheet.write_number(row, column, value, number_format)
    else:
        # Explicit strings prevent Excel formula injection.
        sheet.write_string(row, column, str(value))


def build_chart_workbook(
    analysis: dict,
    plan: AnalysisRequest,
    chart_type: str,
    metric_alias: str,
) -> bytes:
    group, _metric, points = _chart_points(
        analysis, plan, chart_type, metric_alias
    )

    buffer = io.BytesIO()

    with xlsxwriter.Workbook(buffer, {
        "in_memory": True,
        "strings_to_formulas": False,
        "strings_to_urls": False,
    }) as workbook:
        chart_sheet = workbook.add_worksheet("Chart")
        data_sheet = workbook.add_worksheet("Verified Data")

        heading = workbook.add_format({
            "bold": True,
            "font_color": "#FFFFFF",
            "bg_color": "#202020",
            "font_size": 14,
        })
        header = workbook.add_format({
            "bold": True,
            "font_color": "#FFFFFF",
            "bg_color": "#D71921",
        })
        number = workbook.add_format({
            "num_format": "#,##0.00",
        })

        chart_sheet.set_column("A:A", 32)
        chart_sheet.set_column("B:B", 20)
        chart_sheet.set_column("C:C", 4)
        chart_sheet.set_column("D:N", 12)
        chart_sheet.freeze_panes(5, 0)

        chart_sheet.write_string(
            0, 0, f"{metric_alias} by {group}", heading
        )
        chart_sheet.write_string(
            2, 0,
            "Verified Pandas results. The Excel chart is editable.",
        )
        chart_sheet.write_string(4, 0, group, header)
        chart_sheet.write_string(4, 1, metric_alias, header)

        for index, (label, value) in enumerate(points, start=5):
            chart_sheet.write_string(index, 0, label)
            chart_sheet.write_number(index, 1, value, number)

        excel_type = {
            "bar": "column",
            "horizontal": "bar",
            "line": "line",
            "area": "area",
            "pie": "pie",
            "donut": "doughnut",
        }[chart_type]

        chart = workbook.add_chart({"type": excel_type})

        series = {
            "name": metric_alias,
            "categories": ["Chart", 5, 0, 4 + len(points), 0],
            "values": ["Chart", 5, 1, 4 + len(points), 1],
        }

        if chart_type in ("pie", "donut") or chart_type in ("bar", "horizontal"):
            series["points"] = [
                {"fill": {"color": COLORS[i % len(COLORS)]}}
                for i in range(len(points))
            ]
        else:
            series["line"] = {"color": COLORS[0], "width": 2}
            if chart_type == "area":
                series["fill"] = {
                    "color": COLORS[0],
                    "transparency": 75,
                }

        chart.add_series(series)
        chart.set_title({"name": f"{metric_alias} by {group}"})
        chart.set_size({"width": 800, "height": 460})
        chart.set_style(10)

        if chart_type in ("pie", "donut"):
            chart.set_legend({"position": "bottom"})
        else:
            chart.set_legend({"none": True})

        chart_sheet.insert_chart("D5", chart)

        data_sheet.set_column("A:E", 23)
        data_sheet.freeze_panes(5, 0)

        data_sheet.write_string(
            0, 0, "VERIFIED ANALYSIS RESULTS", heading
        )

        data_sheet.write_string(
            2, 0,
            "PARTIAL RESULT" if analysis["truncated"]
            else "COMPLETE RESULT",
        )

        columns = analysis["columns"]

        for column_index, name in enumerate(columns):
            data_sheet.write_string(4, column_index, name, header)

        for row_index, row in enumerate(analysis["rows"], start=5):
            for column_index, name in enumerate(columns):
                _write_cell(
                    data_sheet,
                    row_index,
                    column_index,
                    row.get(name),
                    number,
                )

        if analysis["rows"]:
            data_sheet.autofilter(
                4, 0,
                4 + len(analysis["rows"]),
                len(columns) - 1,
            )

    return buffer.getvalue()
