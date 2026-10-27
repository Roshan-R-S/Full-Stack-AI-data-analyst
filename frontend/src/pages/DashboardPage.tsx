import { useEffect, useState } from "react";
import { useActiveDataset } from "../services/activeDataset";
import type { FormEvent } from "react";

import LazyVerifiedChart from
  "../components/charts/LazyVerifiedChart";

import {
  listDatasets,
  getDatasetProfile,
} from "../services/datasetApi";

import { runAnalysis } from "../services/analysisApi";
import { downloadChartExcel } from "../services/exportApi";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import DashboardMultiExport from "../components/dashboard/DashboardMultiExport";

import type {
  Dataset,
  DatasetProfile,
} from "../types/dataset";

import type {
  Aggregation,
  AnalysisRequest,
  AnalysisResult,
  FilterOperator,
} from "../types/analysis";

type Column = DatasetProfile["columns"][number];

interface DashboardConfig {
  datasetId: string;
  group: string;
  primary: string;
  secondary: string;
  aggregation: Aggregation;
  countColumn: string;
  filters: AnalysisRequest["filters"];
}

function isNumeric(column: Column): boolean {
  return /^(?:u?int|float|decimal)/i.test(column.dtype);
}

function preferred(
  columns: Column[],
  names: string[],
): string {
  for (const name of names) {
    const match = columns.find(
      (column) => column.name.toLowerCase() === name.toLowerCase(),
    );
    if (match) return match.name;
  }
  return columns[0]?.name ?? "";
}

function chooseGroup(profile: DatasetProfile): string {
  const candidates = profile.columns.filter(
    (column) =>
      column.unique > 1 &&
      column.unique <= 24 &&
      !/(^|_)id$/i.test(column.name),
  );

  const categorical = candidates.filter(
    (column) => !isNumeric(column),
  );

  return preferred(
    categorical.length ? categorical : candidates,
    [
      "Card_Type",
      "Region",
      "Product",
      "Gender",
      "Occupation",
      "Category",
      "Segment",
    ],
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function getChartResult(
  source: AnalysisResult,
  group: string,
  metric: string,
): AnalysisResult {
  const rows = [...source.rows].sort((a, b) => {
    const left = typeof a[metric] === "number"
      ? a[metric] : Number.NEGATIVE_INFINITY;
    const right = typeof b[metric] === "number"
      ? b[metric] : Number.NEGATIVE_INFINITY;

    return right - left || 0;
  });

  return {
    ...source,
    columns: [group, metric],
    rows: rows.map((row) => ({
      [group]: row[group] ?? null,
      [metric]: row[metric] ?? null,
    })),
  };
}

export default function DashboardPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const {
    activeDatasetId,
    setActiveDatasetId,
    reconcileDatasets,
  } = useActiveDataset();

  const datasetId =
    datasets.some((item) => item.id === activeDatasetId)
      ? activeDatasetId
      : "";
  const [profile, setProfile] =
    useState<DatasetProfile | null>(null);

  const [group, setGroup] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [aggregation, setAggregation] =
    useState<Aggregation>("mean");

  const [filterColumn, setFilterColumn] = useState("");
  const [filterOperator, setFilterOperator] =
    useState<FilterOperator>("eq");
  const [filterValue, setFilterValue] = useState("");

  const [applied, setApplied] =
    useState<DashboardConfig | null>(null);

  const [result, setResult] =
    useState<AnalysisResult | null>(null);
  const [resultPlan, setResultPlan] =
    useState<AnalysisRequest | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    listDatasets()
      .then((items) => {
        if (!active) return;
        setDatasets(items);
        reconcileDatasets(items);
      })
      .catch((err: unknown) => {
        if (active) setError(getError(err));
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    setProfile(null);
    setApplied(null);
    setResult(null);
    setError("");

    if (!datasetId) return;

    let active = true;
    setLoadingProfile(true);

    getDatasetProfile(datasetId)
      .then((data) => {
        if (!active) return;

        const numeric = data.columns.filter(isNumeric);

        const defaultGroup = chooseGroup(data);
        const defaultPrimary = preferred(numeric, [
          "Annual_Income",
          "Revenue",
          "Credit_Score",
          "Monthly_Spend",
          "Quantity",
          "Age",
        ]) || data.columns[0]?.name || "";

        const defaultSecondary = preferred(
          numeric.filter((c) => c.name !== defaultPrimary),
          [
            "Credit_Score",
            "Monthly_Spend",
            "Credit_Limit",
            "Quantity",
            "Age",
          ],
        );

        const defaultAggregation: Aggregation =
          numeric.length ? "mean" : "count";

        const countColumn =
          data.columns.find((c) => c.missing === 0)?.name ??
          data.columns[0]?.name ??
          "";

        setProfile(data);
        setGroup(defaultGroup);
        setPrimary(defaultPrimary);
        setSecondary(defaultSecondary);
        setAggregation(defaultAggregation);
        setFilterColumn("");
        setFilterOperator("eq");
        setFilterValue("");

        if (defaultGroup && defaultPrimary && countColumn) {
          setApplied({
            datasetId,
            group: defaultGroup,
            primary: defaultPrimary,
            secondary: defaultSecondary,
            aggregation: defaultAggregation,
            countColumn,
            filters: [],
          });
        }
      })
      .catch((err: unknown) => {
        if (active) setError(getError(err));
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => { active = false; };
  }, [datasetId]);

  useEffect(() => {
    if (!applied || applied.datasetId !== datasetId) return;

    let active = true;
    setRunning(true);
    setResult(null);
    setResultPlan(null);
    setError("");

    const metrics: AnalysisRequest["metrics"] = [
      {
        column: applied.primary,
        aggregation: applied.aggregation,
        alias: "primary_value",
      },
      {
        column: applied.countColumn,
        aggregation: "count",
        alias: "group_count",
      },
    ];

    if (applied.secondary) {
      metrics.push({
        column: applied.secondary,
        aggregation: "mean",
        alias: "secondary_value",
      });
    }

    const plan: AnalysisRequest = {
      dataset_id: applied.datasetId,
      group_by: [applied.group],
      metrics,
      filters: applied.filters,
      sort: {
        column: "primary_value",
        direction: "desc",
      },
      limit: 100,
    };

    runAnalysis(plan)
      .then((data) => {
        if (active) {
          setResult(data);
          setResultPlan(plan);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(getError(err));
      })
      .finally(() => {
        if (active) setRunning(false);
      });

    return () => { active = false; };
  }, [applied, datasetId]);

  const selected = datasets.find((d) => d.id === datasetId);
  const columns = profile?.columns ?? [];
  const numeric = columns.filter(isNumeric);

  const currentMetric = columns.find(
    (column) => column.name === primary,
  );

  const allowedAggregations: Aggregation[] =
    currentMetric && isNumeric(currentMetric)
      ? ["mean", "sum", "min", "max", "count", "nunique"]
      : ["count", "nunique"];

  const activeFilter = columns.find(
    (column) => column.name === filterColumn,
  );

  const numericFilter = Boolean(
    activeFilter && isNumeric(activeFilter),
  );

  const operators: FilterOperator[] = numericFilter
    ? ["eq", "ne", "gt", "gte", "lt", "lte", "in"]
    : ["eq", "ne", "in", "contains"];

  function applyDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || !selected || !group || !primary) return;

    setError("");

    try {
      const filters: AnalysisRequest["filters"] = [];

      if (filterColumn) {
        const raw = filterValue.trim();

        if (!raw) throw new Error("Enter a filter value.");

        const parts = filterOperator === "in"
          ? raw.split(",").map((v) => v.trim()).filter(Boolean)
          : [raw];

        if (
          filterOperator === "in" &&
          (parts.length < 1 || parts.length > 20)
        ) {
          throw new Error("Use 1 to 20 filter values.");
        }

        const values = parts.map((part) => {
          if (!numericFilter) return part;

          const number = Number(part);

          if (!Number.isFinite(number)) {
            throw new Error("Filter requires numeric values.");
          }

          return number;
        });

        filters.push({
          column: filterColumn,
          operator: filterOperator,
          value: filterOperator === "in"
            ? values
            : values[0],
        });
      }

      setApplied({
        datasetId,
        group,
        primary,
        secondary,
        aggregation,
        countColumn:
          columns.find((c) => c.missing === 0)?.name ??
          columns[0].name,
        filters,
      });
    } catch (err) {
      setError(getError(err));
    }
  }

  const cards = applied && result
    ? [
        {
          key: "primary_value",
          heading: `${applied.aggregation.toUpperCase()} / ${applied.primary}`,
          aggregation: applied.aggregation,
        },
        {
          key: "group_count",
          heading: `COUNT / ${applied.countColumn}`,
          aggregation: "count" as Aggregation,
        },
        ...(applied.secondary
          ? [{
              key: "secondary_value",
              heading: `MEAN / ${applied.secondary}`,
              aggregation: "mean" as Aggregation,
            }]
          : []),
      ]
    : [];

  return (
    <div className="intelligence-dashboard">
      <div className="section-heading">
        <span>04 / DATA INTELLIGENCE</span>
        <span>{running ? "[COMPUTING]" : "[PANDAS VERIFIED]"}</span>
      </div>

      <section className="dashboard-kpis">
        {[
          ["SOURCE RECORDS", selected?.row_count],
          ["COLUMNS", selected?.column_count],
          ["MISSING CELLS", profile?.missing_cells],
          ["DUPLICATE ROWS", profile?.duplicate_rows],
          ["MATCHED RECORDS", result?.matched_rows],
        ].map(([label, value]) => (
          <div className="dashboard-kpi" key={String(label)}>
            <span>{label}</span>
            <strong>
              {typeof value === "number"
                ? formatNumber(value)
                : "—"}
            </strong>
          </div>
        ))}
      </section>

      <form className="dashboard-controls" onSubmit={applyDashboard}>
        <div className="section-heading">
          <span>DASHBOARD / CONFIGURATION</span>
          <span>ONE QUERY / MULTIPLE VIEWS</span>
        </div>

        <div className="dashboard-control-grid">
          <label className="analysis-field">
            <span>DATASET</span>
            <select
              value={datasetId}
              onChange={(e) => setActiveDatasetId(e.target.value)}
              disabled={running || loadingProfile}
            >
              {datasets.length === 0 && (
                <option value="">NO DATASETS</option>
              )}
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.filename}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>GROUP BY</span>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              disabled={!profile || loadingProfile || running}
            >
              {!group && <option value="">SELECT COLUMN</option>}
              {columns
                .filter((c) =>
                  c.unique > 1 && !/(^|_)id$/i.test(c.name))
                .map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>PRIMARY METRIC</span>
            <select
              value={primary}
              onChange={(e) => {
                const name = e.target.value;
                setPrimary(name);

                const col = columns.find((c) => c.name === name);
                if (col && !isNumeric(col)) {
                  setAggregation("count");
                }
              }}
              disabled={!profile || loadingProfile || running}
            >
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>AGGREGATION</span>
            <select
              value={aggregation}
              onChange={(e) =>
                setAggregation(e.target.value as Aggregation)
              }
              disabled={!profile || loadingProfile || running}
            >
              {allowedAggregations.map((operation) => (
                <option key={operation} value={operation}>
                  {operation.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>SECONDARY METRIC</span>
            <select
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              disabled={!profile || loadingProfile || running}
            >
              <option value="">NONE</option>
              {numeric
                .filter((c) => c.name !== primary)
                .map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>FILTER COLUMN</span>
            <select
              value={filterColumn}
              onChange={(e) => {
                setFilterColumn(e.target.value);
                setFilterOperator("eq");
                setFilterValue("");
              }}
              disabled={!profile || loadingProfile || running}
            >
              <option value="">NO FILTER</option>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>FILTER OPERATOR</span>
            <select
              value={filterOperator}
              onChange={(e) =>
                setFilterOperator(
                  e.target.value as FilterOperator,
                )
              }
              disabled={!filterColumn || running}
            >
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>FILTER VALUE</span>
            <input
              type="text"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder={
                filterOperator === "in"
                  ? "VALUE1, VALUE2"
                  : "ENTER VALUE"
              }
              disabled={!filterColumn || running}
            />
          </label>
        </div>

        <div className="dashboard-actions">
          <button
            type="submit"
            className="nd-btn"
            disabled={
              !profile ||
              !group ||
              !primary ||
              loadingProfile ||
              running
            }
          >
            {running ? "[ COMPUTING... ]" : "[ UPDATE DASHBOARD ]"}
          </button>
          <span>
            {applied?.filters.length
              ? "[FILTERED VIEW]"
              : "[ALL RECORDS]"}
          </span>
        </div>

        {error && (
          <p className="inline-error" role="alert">
            [ERROR] {error}
          </p>
        )}
      </form>

      {loadingProfile && (
        <p className="meta-note">[LOADING DATASET PROFILE...]</p>
      )}

      {running && (
        <LoadingSkeleton
          variant="chart"
          label="Computing dashboard results"
        />
      )}

      {!running && profile && !group && (
        <p className="meta-note">
          [NO SUITABLE GROUPING COLUMN] Select a different dataset.
        </p>
      )}

      {result && applied && !running && (
        <>
          <div className="section-heading dashboard-results-heading">
            <span>VISUALIZATIONS / {result.result_count} GROUPS</span>
            <span>
              {result.truncated
                ? "[PARTIAL RESULT]"
                : "[COMPLETE RESULT]"}
            </span>
          </div>

          {resultPlan?.dataset_id === datasetId && (
            <DashboardMultiExport
              plan={resultPlan}
              result={result}
              group={applied.group}
              metrics={cards.map((card) => ({
                alias: card.key,
                label: card.heading,
                aggregation: card.aggregation,
              }))}
            />
          )}

          <div className="dashboard-chart-grid">
            {cards.map((card) => (
              <section className="dashboard-chart-card" key={card.key}>
                <p className="dashboard-chart-label">
                  {card.heading}
                </p>

                <LazyVerifiedChart
                  showDataTable={false}
                  result={getChartResult(
                    result,
                    applied.group,
                    card.key,
                  )}
                  groupBy={[applied.group]}
                  aggregation={card.aggregation}
                  onExportExcel={resultPlan
                    ? (mode) => downloadChartExcel(
                        resultPlan,
                        mode,
                        card.key,
                      )
                    : undefined}
                />
              </section>
            ))}
          </div>

          <section className="dashboard-verified-table">
            <div className="section-heading">
              <span>DATA / VERIFIED RESULTS</span>
              <span>
                {result.returned_rows} OF {result.result_count} GROUPS
              </span>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {result.columns.map((column) => (
                      <th
  key={column}
  scope="col"
  className={result.rows.some(
    (row) => typeof row[column] === "number",
  ) ? "numeric-cell" : undefined}
>
                        {column === "primary_value"
                          ? `${applied.aggregation.toUpperCase()} / ${applied.primary}`
                          : column === "group_count"
                            ? `COUNT / ${applied.countColumn}`
                            : column === "secondary_value"
                              ? `MEAN / ${applied.secondary}`
                              : column}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={index}>
                      {result.columns.map((column) => (
                        <td
                          key={column}
                          className={
                            typeof row[column] === "number"
                              ? "numeric-cell"
                              : undefined
                          }
                        >
                          {typeof row[column] === "number"
                            ? formatNumber(row[column])
                            : String(row[column] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="dashboard-note">
              [SOURCE: PANDAS] Results are computed on the
              server. Source dataset KPIs remain unfiltered.
              {result.truncated &&
                " Only the first 100 analytical groups are returned."}
            </p>
          </section>
        </>
      )}
    </div>
  );
}