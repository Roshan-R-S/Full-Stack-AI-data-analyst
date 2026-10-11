import { useState } from "react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import type {
  Aggregation,
  AnalysisResult,
} from "../../types/analysis";

type ChartMode = "bar" | "line" | "donut";

interface Props {
  result: AnalysisResult;
  groupBy?: string[];
  aggregation?: Aggregation;
}

interface ChartPoint {
  label: string;
  value: number;
  order: number | null;
}

const palette = [
  "var(--text-display)",
  "#999999",
  "#777777",
  "#555555",
  "#BBBBBB",
  "#666666",
  "#888888",
  "#444444",
];

function formatValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function compactValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function sequenceValue(
  value: unknown,
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

export default function VerifiedChart({
  result,
  groupBy,
  aggregation,
}: Props) {
  const [selectedMode, setSelectedMode] =
    useState<ChartMode>("bar");

  const groupColumn = groupBy?.[0];

  const metricColumn = result.columns.find(
    (column) =>
      column !== groupColumn &&
      result.rows.some(
        (row) => typeof row[column] === "number",
      ),
  );

  // A single overall metric is a KPI, not a category chart.
  if (!groupColumn || !metricColumn) {
    return null;
  }

  const points: ChartPoint[] = result.rows
    .filter(
      (row) =>
        typeof row[metricColumn] === "number" &&
        Number.isFinite(row[metricColumn]),
    )
    .map((row) => ({
      label: String(row[groupColumn] ?? "UNKNOWN"),
      value: Number(row[metricColumn]),
      order: sequenceValue(row[groupColumn]),
    }));

  if (points.length === 0) {
    return null;
  }

  const complete =
    !result.truncated &&
    result.returned_rows === result.result_count;

  const orderedColumn =
    /date|year|month|week|day|period|^age$/i.test(
      groupColumn,
    );

  const canUseLine =
    orderedColumn &&
    points.length >= 2 &&
    points.every((point) => point.order !== null);

  // Percent shares of averages are misleading.
  // Only allow donuts for complete, additive results.
  const canUseDonut =
    complete &&
    points.length >= 2 &&
    points.length <= 8 &&
    (aggregation === "count" || aggregation === "sum") &&
    points.every((point) => point.value >= 0) &&
    points.some((point) => point.value > 0);

  const modes: ChartMode[] = ["bar"];

  if (canUseLine) modes.push("line");
  if (canUseDonut) modes.push("donut");

  const mode = modes.includes(selectedMode)
    ? selectedMode
    : "bar";

  const orderedPoints = canUseLine
    ? [...points].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      )
    : points;

  const visiblePoints = (
    mode === "line" ? orderedPoints : points
  ).slice(0, 24);

  const tooltipStyle = {
    backgroundColor: "var(--surface-raised)",
    border: "1px solid var(--border-visible)",
    borderRadius: 4,
    color: "var(--text-primary)",
    fontFamily: "Space Mono, monospace",
    fontSize: 12,
  };

  const tooltip = (
    <Tooltip cursor={false}
      contentStyle={tooltipStyle}
      formatter={(value) => [
        formatValue(Number(value)),
        `${aggregation?.toUpperCase() ?? "VALUE"} / ${metricColumn}`,
      ]}
    />
  );

  return (
    <section
      className="verified-chart"
      aria-label="Verified data visualization"
    >
      <div className="verified-chart-header">
        <div>
          <p className="verified-chart-eyebrow">
            VISUALIZATION / VERIFIED DATA
          </p>
          <h3>
            {aggregation?.toUpperCase() ?? "METRIC"} BY{" "}
            {groupColumn}
          </h3>
        </div>

        <div
          className="verified-chart-modes"
          aria-label="Chart type"
        >
          {modes.map((option) => (
            <button
              key={option}
              type="button"
              className={
                mode === option ? "active" : ""
              }
              aria-pressed={mode === option}
              onClick={() => setSelectedMode(option)}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="verified-chart-canvas">
        {mode === "bar" && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={visiblePoints}
              margin={{
                top: 14,
                right: 18,
                bottom: 10,
                left: 4,
              }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border-visible)"
                strokeDasharray="2 5"
              />

              <XAxis
                dataKey="label"
                interval={0}
                angle={-25}
                textAnchor="end"
                height={82}
                tick={{
                  fill: "var(--text-secondary)",
                  fontSize: 10,
                }}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                width={72}
                tickFormatter={compactValue}
                tick={{
                  fill: "var(--text-secondary)",
                  fontSize: 10,
                }}
                tickLine={false}
                axisLine={false}
              />

              {tooltip}

              <Bar
                dataKey="value"
                fill="var(--text-display)"
                maxBarSize={46}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {mode === "line" && (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={visiblePoints}
              margin={{
                top: 14,
                right: 18,
                bottom: 10,
                left: 4,
              }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border-visible)"
                strokeDasharray="2 5"
              />

              <XAxis
                dataKey="label"
                height={55}
                tick={{
                  fill: "var(--text-secondary)",
                  fontSize: 10,
                }}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                width={72}
                tickFormatter={compactValue}
                tick={{
                  fill: "var(--text-secondary)",
                  fontSize: 10,
                }}
                tickLine={false}
                axisLine={false}
              />

              {tooltip}

              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--text-display)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {mode === "donut" && (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={visiblePoints}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={112}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {visiblePoints.map((point, index) => (
                    <Cell
                      key={point.label}
                      fill={palette[index % palette.length]}
                    />
                  ))}
                </Pie>

                {tooltip}
              </PieChart>
            </ResponsiveContainer>

            <div className="verified-chart-legend">
              {visiblePoints.map((point, index) => (
                <div key={point.label}>
                  <span
                    className="legend-swatch"
                    style={{
                      background:
                        palette[index % palette.length],
                    }}
                  />
                  <span>{point.label}</span>
                  <strong>
                    {formatValue(point.value)}
                  </strong>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="verified-chart-note">
        [PANDAS / VERIFIED] {visiblePoints.length} DISPLAYED
        {result.result_count > visiblePoints.length &&
          ` OF ${result.result_count} GROUPS`}
        {result.truncated &&
          " â€” PARTIAL RESULT. NOT A FULL COMPARISON."}
      </p>
    </section>
  );
}