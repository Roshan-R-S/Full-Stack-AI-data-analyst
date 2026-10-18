import { useEffect, useState } from "react";
import { useActiveDataset } from "../services/activeDataset";
import VerifiedChart from "../components/charts/LazyVerifiedChart";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import type { FormEvent } from "react";

import {
  getDatasetProfile,
  listDatasets,
} from "../services/datasetApi";

import { runAnalysis } from "../services/analysisApi";
import { downloadAnalysisCSV, downloadAnalysisPDF, downloadChartExcel } from "../services/exportApi";
import {
  listSavedAnalyses,
  getSavedAnalysis,
  createSavedAnalysis,
  renameSavedAnalysis,
  rerunSavedAnalysis,
  deleteSavedAnalysis,
} from "../services/savedAnalysisApi";
import type {
  SavedAnalysisSummary,
} from "../types/savedAnalysis";

import type {
  Dataset,
  DatasetProfile,
} from "../types/dataset";

import type {
  Aggregation,
  FilterOperator,
  AnalysisRequest,
  AnalysisResult,
} from "../types/analysis";

const aggregations: Aggregation[] = [
  "sum", "mean", "min", "max", "count", "nunique",
];

function isNumeric(dtype: string) {
  return /^(?:u?int|float|decimal)/i.test(dtype);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value);
  }

  return String(value);
}

export default function AnalystPage() {
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
  const [profile, setProfile] = useState<DatasetProfile | null>(null);

  const [metricColumn, setMetricColumn] = useState("");
  const [aggregation, setAggregation] =
    useState<Aggregation>("mean");

  const [groupBy, setGroupBy] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterOperator, setFilterOperator] =
    useState<FilterOperator>("eq");
  const [filterValue, setFilterValue] = useState("");

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(50);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lastPlan, setLastPlan] = useState<AnalysisRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("[READY]");
  const [savedItems, setSavedItems] =
    useState<SavedAnalysisSummary[]>([]);
  const [savedBusy, setSavedBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedError, setSavedError] = useState("");

  useEffect(() => {
    let active = true;

    listDatasets()
      .then((items) => {
        if (!active) return;
        setDatasets(items);
        reconcileDatasets(items);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to list datasets",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!datasetId) {
      setProfile(null);
      setResult(null);
      return;
    }

    let active = true;

    setLoading(true);
    setProfile(null);
    setResult(null);
    setLastPlan(null);
    setError("");
    setSavedError("");
    setStatus("[LOADING DATASET...]");

    getDatasetProfile(datasetId)
      .then((data) => {
        if (!active) return;

        const numeric = data.columns.filter((col) =>
          isNumeric(col.dtype),
        );

        setProfile(data);
        setMetricColumn(
          numeric[0]?.name ?? data.columns[0]?.name ?? "",
        );
        setAggregation(numeric.length > 0 ? "mean" : "count");

        setGroupBy("");
        setFilterColumn("");
        setFilterOperator("eq");
        setFilterValue("");
        setStatus("[DATASET READY]");
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dataset",
          );
          setStatus("[ERROR]");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [datasetId]);

  useEffect(() => {
    let active = true;

    setSavedItems([]);
    setSavedError("");

    if (!datasetId) return;

    listSavedAnalyses(datasetId)
      .then((items) => {
        if (active) setSavedItems(items);
      })
      .catch((err: unknown) => {
        if (active) {
          setSavedError(
            err instanceof Error ? err.message : "Unable to load saved analyses",
          );
        }
      });

    return () => { active = false; };
  }, [datasetId]);

  const columns = profile?.columns ?? [];
  const numericColumns = columns.filter((column) =>
    isNumeric(column.dtype),
  );

  const eligibleColumns =
    aggregation === "count" || aggregation === "nunique"
      ? columns
      : numericColumns;

  const filterIsNumeric = columns.some(
    (column) =>
      column.name === filterColumn && isNumeric(column.dtype),
  );

  const filterOperators: FilterOperator[] = filterIsNumeric
    ? ["eq", "ne", "gt", "gte", "lt", "lte", "in"]
    : ["eq", "ne", "in", "contains"];

  function onAggregationChange(next: Aggregation) {
    setAggregation(next);

    const eligible =
      next === "count" || next === "nunique"
        ? columns
        : numericColumns;

    if (!eligible.some((column) => column.name === metricColumn)) {
      setMetricColumn(eligible[0]?.name ?? "");
    }
  }

  function buildFilter(): AnalysisRequest["filters"] {
    if (!filterColumn) return [];

    const raw = filterValue.trim();

    if (!raw) {
      throw new Error("Enter a filter value.");
    }

    if (filterOperator === "in") {
      const items = raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (items.length < 1 || items.length > 20) {
        throw new Error("Provide between 1 and 20 filter values.");
      }

      const values = filterIsNumeric
        ? items.map(Number)
        : items;

      if (
        filterIsNumeric &&
        (values as number[]).some((value) => !Number.isFinite(value))
      ) {
        throw new Error("Filter values must be numeric.");
      }

      return [{
        column: filterColumn,
        operator: "in",
        value: values,
      }];
    }

    let value: string | number = raw;

    if (filterIsNumeric) {
      value = Number(raw);

      if (!Number.isFinite(value)) {
        throw new Error("Filter value must be numeric.");
      }
    }

    return [{
      column: filterColumn,
      operator: filterOperator,
      value,
    }];
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!datasetId || !metricColumn || !profile) return;

    setRunning(true);
    setResult(null);
    setError("");
    setStatus("[ANALYZING...]");

    try {
      const plan: AnalysisRequest = {
        dataset_id: datasetId,
        group_by: groupBy ? [groupBy] : [],
        filters: buildFilter(),
        metrics: [{
          column: metricColumn,
          aggregation,
          alias: "result",
        }],
        sort: {
          column: "result",
          direction: sortDirection,
        },
        limit,
      };

      const response = await runAnalysis(plan);

      setResult(response);
      setLastPlan(plan);
      setStatus("[ANALYSIS COMPLETE]");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Analysis failed",
      );
      setStatus("[ERROR]");
    } finally {
      setRunning(false);
    }
  }

  async function exportPdfReport() {
    if (
      !result ||
      !lastPlan ||
      running ||
      loading ||
      exporting ||
      lastPlan.dataset_id !== datasetId
    ) return;

    setExporting(true);
    setError("");
    setStatus("[EXPORTING PDF...]");

    try {
      await downloadAnalysisPDF(lastPlan);
      setStatus("[PDF EXPORT READY]");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "PDF export failed",
      );
      setStatus("[EXPORT ERROR]");
    } finally {
      setExporting(false);
    }
  }

  async function exportLastRun() {
    if (
      !result ||
      !lastPlan ||
      running ||
      loading ||
      exporting ||
      lastPlan.dataset_id !== datasetId
    ) return;

    setExporting(true);
    setError("");
    setStatus("[EXPORTING CSV...]");

    try {
      await downloadAnalysisCSV(lastPlan);
      setStatus("[CSV EXPORT READY]");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "CSV export failed",
      );
      setStatus("[EXPORT ERROR]");
    } finally {
      setExporting(false);
    }
  }

  async function refreshSaved() {
    const items = await listSavedAnalyses(datasetId);
    setSavedItems(items);
  }

  async function saveLastRun() {
    if (
      !lastPlan ||
      !result ||
      running ||
      savedBusy ||
      lastPlan.dataset_id !== datasetId
    ) return;

    const metric = lastPlan.metrics[0];
    const suggested = [
      metric.aggregation.toUpperCase(),
      metric.column,
      lastPlan.group_by.length
        ? `BY ${lastPlan.group_by.join(", ")}`
        : "",
    ].filter(Boolean).join(" ");

    const input = window.prompt(
      "Save verified analysis as:",
      suggested,
    );

    if (input === null) return;

    const name = input.trim();

    if (!name || name.length > 120) {
      setSavedError("Name must contain 1 to 120 characters.");
      return;
    }

    setSavedBusy(true);
    setSavedError("");

    try {
      await createSavedAnalysis(name, lastPlan);
      await refreshSaved();
      setStatus("[ANALYSIS SAVED]");
    } catch (err) {
      setSavedError(
        err instanceof Error ? err.message : "Unable to save analysis",
      );
    } finally {
      setSavedBusy(false);
    }
  }

  function restoreEditor(plan: AnalysisRequest) {
    if (
      plan.metrics.length !== 1 ||
      plan.group_by.length > 1 ||
      plan.filters.length > 1 ||
      (plan.sort && plan.sort.column !== plan.metrics[0].alias)
    ) {
      throw new Error(
        "This saved plan exceeds the current editor's capabilities. " +
        "Use RERUN to execute its complete configuration.",
      );
    }

    const filter = plan.filters[0];

    if (filter) {
      const values = Array.isArray(filter.value)
        ? filter.value
        : [filter.value];

      if (values.some((value) => typeof value === "boolean")) {
        throw new Error(
          "Boolean filters cannot be edited here. Use RERUN instead.",
        );
      }
    }

    const metric = plan.metrics[0];

    setAggregation(metric.aggregation);
    setMetricColumn(metric.column);
    setGroupBy(plan.group_by[0] ?? "");

    setFilterColumn(filter?.column ?? "");
    setFilterOperator(filter?.operator ?? "eq");

    setFilterValue(
      filter
        ? Array.isArray(filter.value)
          ? filter.value.join(", ")
          : String(filter.value)
        : "",
    );

    setSortDirection(plan.sort?.direction ?? "desc");
    setLimit(plan.limit);
    setResult(null);
    setLastPlan(null);
    setStatus("[SAVED CONFIGURATION LOADED]");
  }

  async function loadSaved(id: string) {
    if (loading || running || savedBusy || !profile) return;

    setSavedBusy(true);
    setSavedError("");

    try {
      const saved = await getSavedAnalysis(id);

      if (saved.dataset_id !== datasetId) {
        throw new Error("Saved analysis belongs to another dataset.");
      }

      restoreEditor(saved.plan);
    } catch (err) {
      setSavedError(
        err instanceof Error ? err.message : "Unable to load analysis",
      );
    } finally {
      setSavedBusy(false);
    }
  }

  async function runSaved(id: string) {
    if (loading || running || savedBusy || !profile) return;

    setRunning(true);
    setResult(null);
    setSavedError("");
    setError("");
    setStatus("[RUNNING SAVED ANALYSIS...]");

    try {
      const response = await rerunSavedAnalysis(id);

      if (response.plan.dataset_id !== datasetId) {
        throw new Error("Saved result belongs to another dataset.");
      }

      setLastPlan(response.plan);
      setResult(response.analysis);
      setStatus("[SAVED ANALYSIS COMPLETE]");
    } catch (err) {
      setSavedError(
        err instanceof Error ? err.message : "Unable to rerun analysis",
      );
      setStatus("[ERROR]");
    } finally {
      setRunning(false);
    }
  }

  async function renameSaved(id: string) {
    if (loading || running || savedBusy) return;

    const current = savedItems.find((item) => item.id === id);
    if (!current) return;

    const entered = window.prompt(
      "Rename saved analysis:",
      current.name,
    );

    if (entered === null) return;

    const name = entered.trim();

    if (!name || name.length > 120) {
      setSavedError("Name must contain 1 to 120 characters.");
      return;
    }

    setSavedBusy(true);
    setSavedError("");

    try {
      await renameSavedAnalysis(id, name);
      await refreshSaved();
    } catch (err) {
      setSavedError(
        err instanceof Error ? err.message : "Unable to rename analysis",
      );
    } finally {
      setSavedBusy(false);
    }
  }

  async function removeSaved(id: string) {
    if (loading || running || savedBusy) return;

    const current = savedItems.find((item) => item.id === id);
    if (!current) return;

    if (!window.confirm(
      `Delete saved analysis "${current.name}"?`,
    )) return;

    setSavedBusy(true);
    setSavedError("");

    try {
      await deleteSavedAnalysis(id);
      setSavedItems((items) =>
        items.filter((item) => item.id !== id),
      );
    } catch (err) {
      setSavedError(
        err instanceof Error ? err.message : "Unable to delete analysis",
      );
    } finally {
      setSavedBusy(false);
    }
  }

  return (
    <div className="analysis-workspace">
      <form className="analysis-form" onSubmit={handleAnalyze}>
        <div className="section-heading">
          <span>ANALYSIS / CONFIGURATION</span>
          <span>DETERMINISTIC ENGINE</span>
        </div>

        <div className="analysis-form-grid">
          <label className="analysis-field">
            <span>01 / DATASET</span>
            <select
              value={datasetId}
              onChange={(event) => setActiveDatasetId(event.target.value)}
              disabled={loading || running || savedBusy}
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
            <span>02 / OPERATION</span>
            <select
              value={aggregation}
              onChange={(event) =>
                onAggregationChange(event.target.value as Aggregation)
              }
              disabled={!profile || loading}
            >
              {aggregations.map((operation) => (
                <option key={operation} value={operation}>
                  {operation.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>03 / METRIC COLUMN</span>
            <select
              value={metricColumn}
              onChange={(event) =>
                setMetricColumn(event.target.value)
              }
              disabled={!profile || loading}
            >
              {eligibleColumns.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>04 / GROUP BY</span>
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value)}
              disabled={!profile || loading}
            >
              <option value="">NO GROUPING</option>
              {columns.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>05 / FILTER COLUMN</span>
            <select
              value={filterColumn}
              onChange={(event) => {
                setFilterColumn(event.target.value);
                setFilterOperator("eq");
                setFilterValue("");
              }}
              disabled={!profile || loading}
            >
              <option value="">NO FILTER</option>
              {columns.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>06 / FILTER OPERATOR</span>
            <select
              value={filterOperator}
              onChange={(event) =>
                setFilterOperator(
                  event.target.value as FilterOperator,
                )
              }
              disabled={!filterColumn || loading}
            >
              {filterOperators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="analysis-field">
            <span>07 / FILTER VALUE</span>
            <input
              type="text"
              placeholder={
                filterOperator === "in"
                  ? "VALUE1, VALUE2"
                  : "ENTER VALUE"
              }
              value={filterValue}
              onChange={(event) =>
                setFilterValue(event.target.value)
              }
              disabled={!filterColumn || loading}
            />
          </label>

          <label className="analysis-field">
            <span>08 / SORT</span>
            <select
              value={sortDirection}
              onChange={(event) =>
                setSortDirection(
                  event.target.value as "asc" | "desc",
                )
              }
            >
              <option value="desc">DESCENDING</option>
              <option value="asc">ASCENDING</option>
            </select>
          </label>

          <label className="analysis-field">
            <span>09 / RESULT LIMIT</span>
            <select
              value={limit}
              onChange={(event) =>
                setLimit(Number(event.target.value))
              }
            >
              {[...new Set([10, 25, 50, 100, limit])]
                .sort((a, b) => a - b)
                .map((value) => (
                <option key={value} value={value}>
                  {value} ROWS
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="analysis-actions">
          <button
            type="submit"
            className="nd-btn analysis-run"
            disabled={
              loading || running || !profile || !metricColumn
            }
          >
            {running ? "[ PROCESSING... ]" : "[ RUN ANALYSIS ]"}
          </button>

          <button
            type="button"
            className="nd-outline"
            onClick={() => void saveLastRun()}
            disabled={
              !result ||
              !lastPlan ||
              loading ||
              running ||
              savedBusy ||
              lastPlan.dataset_id !== datasetId
            }
          >
            [ SAVE LAST RUN ]
          </button>

          <button
            type="button"
            className="nd-outline"
            onClick={() => void exportLastRun()}
            disabled={
              !result ||
              !lastPlan ||
              running ||
              loading ||
              exporting ||
              lastPlan.dataset_id !== datasetId
            }
          >
            {exporting ? "[ EXPORTING... ]" : "[ EXPORT CSV ]"}
          </button>

          <button
            type="button"
            className="nd-outline"
            onClick={() => void exportPdfReport()}
            disabled={
              !result ||
              !lastPlan ||
              running ||
              loading ||
              exporting ||
              lastPlan.dataset_id !== datasetId
            }
          >
            [ EXPORT PDF ]
          </button>

          <span className="analysis-status" role="status">
            {status}
          </span>
        </div>

        {error && (
          <p className="inline-error" role="alert">
            [ERROR] {error}
          </p>
        )}
      </form>

      <section
        className="saved-analysis-section"
        aria-label="Saved analyses"
      >
        <div className="section-heading">
          <span>ANALYSIS / SAVED CONFIGURATIONS</span>
          <span>{savedItems.length} SAVED</span>
        </div>

        <p className="saved-analysis-hint">
          SAVE LAST RUN stores the last successfully verified plan.
          LOAD opens compatible plans in the editor.
          RERUN executes the entire saved plan using Pandas.
        </p>

        {savedError && (
          <p className="inline-error" role="alert">
            [ERROR] {savedError}
          </p>
        )}

        {savedItems.length === 0 ? (
          <p className="saved-analysis-empty">
            [NO SAVED ANALYSES FOR THIS DATASET]
          </p>
        ) : (
          <div className="saved-analysis-list">
            {savedItems.map((item) => (
              <div
                className="saved-analysis-item"
                key={item.id}
              >
                <div className="saved-analysis-info">
                  <strong title={item.name}>
                    {item.name}
                  </strong>
                  <span>
                    UPDATED{" "}
                    {new Date(item.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="saved-analysis-buttons">
                  <button
                    type="button"
                    onClick={() => void loadSaved(item.id)}
                    disabled={loading || running || savedBusy}
                  >
                    LOAD
                  </button>
                  <button
                    type="button"
                    onClick={() => void runSaved(item.id)}
                    disabled={loading || running || savedBusy}
                  >
                    RERUN
                  </button>
                  <button
                    type="button"
                    onClick={() => void renameSaved(item.id)}
                    disabled={loading || running || savedBusy}
                  >
                    REN
                  </button>
                  <button
                    type="button"
                    className="saved-analysis-delete"
                    onClick={() => void removeSaved(item.id)}
                    disabled={loading || running || savedBusy}
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="analysis-output">
        <div className="section-heading">
          <span>ANALYSIS / OUTPUT</span>
          <span>{result ? "COMPUTED BY PANDAS" : "AWAITING QUERY"}</span>
        </div>

        {running ? (
          <LoadingSkeleton
            variant="chart"
            label="Running verified Pandas analysis"
          />
        ) : !result ? (
          <div className="analysis-empty">
            <p className="analysis-empty-number">[ 00 ]</p>
            <h2>NO RESULTS YET.</h2>
            <p>
              Configure your analytical operation and run the query.
            </p>
          </div>
        ) : (
          <>
            <div className="analysis-metrics">
              <div>
                <span>SOURCE RECORDS</span>
                <strong>{formatValue(result.source_rows)}</strong>
              </div>
              <div>
                <span>MATCHED RECORDS</span>
                <strong>{formatValue(result.matched_rows)}</strong>
              </div>
              <div>
                <span>RESULT GROUPS</span>
                <strong>{formatValue(result.result_count)}</strong>
              </div>
            </div>

            <VerifiedChart
              result={result}
              groupBy={lastPlan?.group_by}
              aggregation={lastPlan?.metrics[0]?.aggregation}
              onExportExcel={lastPlan
                ? (mode) => downloadChartExcel(
                    lastPlan,
                    mode,
                    lastPlan.metrics[0].alias,
                  )
                : undefined}
            />

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column} scope="col">
                        {column === (lastPlan?.metrics[0]?.alias ?? "result")
                          ? `${(lastPlan?.metrics[0]?.aggregation ?? aggregation).toUpperCase()} RESULT`
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
                          {formatValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="analysis-footnote">
              [RETURNED {result.returned_rows} / {result.result_count}]
              {result.truncated && " — RESULT LIMIT APPLIED"}
            </p>
          </>
        )}
      </section>
    </div>
  );
}