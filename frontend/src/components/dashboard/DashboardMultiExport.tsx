import { useState } from "react";
import type { ChartMode } from "../charts/VerifiedChart";
import type {
  Aggregation,
  AnalysisRequest,
  AnalysisResult,
} from "../../types/analysis";
import {
  downloadDashboardExcel,
  type DashboardChartSelection,
} from "../../services/exportApi";

interface MetricOption {
  alias: string;
  label: string;
  aggregation: Aggregation;
}

interface Props {
  plan: AnalysisRequest;
  result: AnalysisResult;
  group: string;
  metrics: MetricOption[];
}

function availableModes(
  result: AnalysisResult,
  group: string,
  metric: MetricOption,
): ChartMode[] {
  const points = result.rows
    .filter((row) =>
      typeof row[metric.alias] === "number" &&
      Number.isFinite(row[metric.alias]),
    )
    .map((row) => ({
      value: Number(row[metric.alias]),
      label: row[group],
    }));

  if (!points.length) return [];

  const modes: ChartMode[] = ["bar", "horizontal"];

  const ordered = points.length >= 2 &&
    /date|year|month|week|day|period|^age$/i.test(group) &&
    points.every(({ label }) => {
      if (typeof label === "number") {
        return Number.isFinite(label);
      }
      if (typeof label !== "string" || !label.trim()) {
        return false;
      }
      if (Number.isFinite(Number(label))) return true;
      return /^\d{4}-\d{2}-\d{2}(?:[ T].+)?$/.test(label) &&
        Number.isFinite(Date.parse(label));
    });

  if (ordered) modes.push("line", "area");

  const additive =
    metric.aggregation === "sum" ||
    metric.aggregation === "count";

  const complete =
    !result.truncated &&
    result.returned_rows === result.result_count;

  const shareable =
    additive && complete && points.length >= 2 &&
    points.every(({ value }) => value >= 0) &&
    points.some(({ value }) => value > 0);

  if (shareable) modes.push("pie", "donut");

  return modes;
}

export default function DashboardMultiExport({
  plan,
  result,
  group,
  metrics,
}: Props) {
  const [selections, setSelections] = useState<
    DashboardChartSelection[]
  >(() => [
    { metric_alias: metrics[0].alias, chart_type: "bar" },
    { metric_alias: metrics[1].alias, chart_type: "horizontal" },
  ]);

  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const available = metrics.flatMap((metric) =>
    availableModes(result, group, metric).map((chart_type) => ({
      metric_alias: metric.alias,
      chart_type,
    })),
  );

  const signature = (item: DashboardChartSelection) =>
    `${item.metric_alias}:${item.chart_type}`;

  const duplicate =
    new Set(selections.map(signature)).size !== selections.length;

  const valid =
    selections.length >= 2 &&
    selections.length <= 6 &&
    !duplicate &&
    selections.every((item) =>
      available.some((option) =>
        signature(option) === signature(item),
      ),
    );

  const nextAvailable = available.find((option) =>
    !selections.some((item) =>
      signature(item) === signature(option),
    ),
  );

  function update(
    index: number,
    change: Partial<DashboardChartSelection>,
  ) {
    setSelections((current) => current.map((item, position) => {
      if (position !== index) return item;

      const next = { ...item, ...change };
      const metric = metrics.find(
        (option) => option.alias === next.metric_alias,
      );

      const modes = metric
        ? availableModes(result, group, metric)
        : [];

      if (!modes.includes(next.chart_type)) {
        next.chart_type = modes[0] ?? "bar";
      }

      return next;
    }));

    setError("");
    setStatus("");
  }

  async function exportCharts() {
    if (!valid || exporting) return;

    setExporting(true);
    setError("");
    setStatus("");

    try {
      await downloadDashboardExcel(plan, selections);
      setStatus("[EXCEL WORKBOOK DOWNLOADED]");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Multi-chart export failed.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <section
      className="dashboard-multi-export"
      aria-labelledby="dashboard-multi-title"
    >
      <div className="dashboard-multi-head">
        <h3 id="dashboard-multi-title">
          EXPORT MULTIPLE CHARTS
        </h3>
        <span className="meta-note">
          2–6 EDITABLE EXCEL CHARTS / ONE WORKSHEET
        </span>
      </div>

      <p className="meta-note">
        PIE / DONUT require complete SUM or COUNT results,
        at least two groups, and nonnegative values.
        Choose a COUNT metric or use SUM aggregation.
        LINE / AREA require an ordered numeric or date axis.
      </p>

      <div className="dashboard-multi-rows">
        {selections.map((selection, index) => {
          const metric = metrics.find(
            (item) => item.alias === selection.metric_alias,
          );
          const modes = metric
            ? availableModes(result, group, metric)
            : [];

          return (
            <div className="dashboard-multi-row" key={index}>
              <span className="dashboard-multi-index">
                {String(index + 1).padStart(2, "0")}
              </span>

              <label>
                <span>METRIC</span>
                <select
                  aria-label={`Chart ${index + 1} metric`}
                  value={selection.metric_alias}
                  disabled={exporting}
                  onChange={(event) => update(index, {
                    metric_alias: event.target.value,
                  })}
                >
                  {metrics.map((item) => (
                    <option key={item.alias} value={item.alias}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>CHART TYPE</span>
                <select
                  aria-label={`Chart ${index + 1} type`}
                  value={selection.chart_type}
                  disabled={exporting}
                  onChange={(event) => update(index, {
                    chart_type: event.target.value as ChartMode,
                  })}
                >
                  {([
                    "bar", "horizontal", "line",
                    "area", "pie", "donut",
                  ] as ChartMode[]).map((mode) => (
                    <option
                      key={mode}
                      value={mode}
                      disabled={!modes.includes(mode)}
                    >
                      {mode.toUpperCase()}
                      {!modes.includes(mode) && " / NOT ELIGIBLE"}
                    </option>
                  ))}
                </select>
              </label>

              {selections.length > 2 && (
                <button
                  type="button"
                  className="nd-outline"
                  disabled={exporting}
                  aria-label={`Remove chart ${index + 1}`}
                  onClick={() => {
                    setSelections((current) =>
                      current.filter((_, position) =>
                        position !== index,
                      ),
                    );
                    setError("");
                    setStatus("");
                  }}
                >
                  REMOVE
                </button>
              )}
            </div>
          );
        })}
      </div>

      {duplicate && (
        <p className="inline-error" role="alert">
          Choose different metric and chart-type combinations.
        </p>
      )}

      {error && (
        <p className="inline-error" role="alert">
          [ERROR] {error}
        </p>
      )}

      {status && <p role="status">{status}</p>}

      <div className="dashboard-multi-actions">
        <button
          type="button"
          className="nd-outline"
          disabled={
            selections.length >= 6 ||
            !nextAvailable ||
            exporting
          }
          onClick={() => {
            if (nextAvailable) {
              setSelections((current) => [
                ...current,
                nextAvailable,
              ]);
              setStatus("");
            }
          }}
        >
          [ + ADD CHART ]
        </button>

        <button
          type="button"
          className="nd-btn"
          disabled={!valid || exporting}
          onClick={() => void exportCharts()}
        >
          {exporting
            ? "[ EXPORTING... ]"
            : `[ EXPORT ${selections.length} CHARTS TO EXCEL ]`}
        </button>
      </div>
    </section>
  );
}
