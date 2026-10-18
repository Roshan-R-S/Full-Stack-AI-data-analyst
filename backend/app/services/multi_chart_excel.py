import io

import xlsxwriter

from app.schemas.analysis import AnalysisRequest
from app.services.chart_excel import COLORS, _chart_points, _write_cell


def build_multi_chart_workbook(
    analysis: dict,
    plan: AnalysisRequest,
    chart_types: list[str],
    metric_alias: str,
    selections: list[tuple[str, str]] | None = None,
) -> bytes:
    kinds = {
        "bar": "column",
        "horizontal": "bar",
        "line": "line",
        "area": "area",
        "pie": "pie",
        "donut": "doughnut",
    }

    selected = selections if selections is not None else [
        (mode, metric_alias) for mode in chart_types
    ]

    if not 2 <= len(selected) <= 6:
        raise ValueError("Select 2 to 6 charts.")
    if len(set(selected)) != len(selected):
        raise ValueError("Duplicate chart selections.")
    if any(mode not in kinds for mode, _ in selected):
        raise ValueError("Unsupported chart type.")

    prepared = [
        (
            mode,
            alias,
            *_chart_points(analysis, plan, mode, alias),
        )
        for mode, alias in selected
    ]

    output = io.BytesIO()

    with xlsxwriter.Workbook(output, {
        "in_memory": True,
        "strings_to_formulas": False,
        "strings_to_urls": False,
    }) as workbook:
        charts = workbook.add_worksheet("Charts")
        source = workbook.add_worksheet("Chart Data")
        verified = workbook.add_worksheet("Verified Data")

        header = workbook.add_format({
            "bold": True,
            "font_color": "#FFFFFF",
            "bg_color": "#D71921",
        })
        number = workbook.add_format({
            "num_format": "#,##0.00",
        })

        charts.set_column("A:P", 12)
        source.set_column("A:R", 25)
        verified.set_column("A:Z", 23)

        charts.write_string(
            0, 2, "MULTI-CHART ANALYSIS", header
        )

        for index, (mode, alias, group, _, points) in enumerate(prepared):
            col = index * 3

            source.write_string(0, col, group, header)
            source.write_string(0, col + 1, alias, header)

            for row, (label, value) in enumerate(points, start=1):
                source.write_string(row, col, label)
                source.write_number(row, col + 1, value, number)

            chart = workbook.add_chart({"type": kinds[mode]})

            series = {
                "name": alias,
                "categories": ["Chart Data", 1, col, len(points), col],
                "values": ["Chart Data", 1, col + 1, len(points), col + 1],
            }

            if mode in ("bar", "horizontal", "pie", "donut"):
                series["points"] = [
                    {"fill": {"color": COLORS[i % len(COLORS)]}}
                    for i in range(len(points))
                ]
            else:
                series["line"] = {"color": COLORS[0], "width": 2}
                if mode == "area":
                    series["fill"] = {
                        "color": COLORS[0],
                        "transparency": 75,
                    }

            chart.add_series(series)
            chart.set_title({
                "name": f"{alias} by {group} / {mode.upper()}"
            })
            chart.set_size({"width": 780, "height": 420})
            chart.set_style(10)

            if mode in ("pie", "donut"):
                chart.set_legend({"position": "bottom"})
            else:
                chart.set_legend({"none": True})

            charts.insert_chart(4 + index * 24, 2, chart)

        columns = analysis["columns"]
        verified.write_string(
            0, 0, "VERIFIED ANALYSIS RESULTS", header
        )
        verified.write_string(
            2, 0,
            "PARTIAL RESULT" if analysis["truncated"]
            else "COMPLETE RESULT",
        )

        for col, name in enumerate(columns):
            verified.write_string(4, col, name, header)

        for row, data in enumerate(analysis["rows"], start=5):
            for col, name in enumerate(columns):
                _write_cell(
                    verified, row, col, data.get(name), number
                )

        if analysis["rows"]:
            verified.autofilter(
                4, 0, 4 + len(analysis["rows"]), len(columns) - 1
            )

    return output.getvalue()
