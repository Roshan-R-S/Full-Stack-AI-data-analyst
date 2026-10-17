import type { ChartMode } from "../components/charts/VerifiedChart";
import { apiFetch } from "./api";
import type { AnalysisRequest } from "../types/analysis";

async function downloadAnalysis(
  plan: AnalysisRequest,
  format: "csv" | "pdf",
): Promise<void> {
  const response = await apiFetch(
    `/exports/analysis/${format}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(plan),
    },
  );

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  const prefix = format === "pdf" ? "report" : "analysis";

  anchor.href = url;
  anchor.download =
    `${prefix}-${plan.dataset_id.slice(0, 8)}.${format}`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function downloadAnalysisPDF(
  plan: AnalysisRequest,
): Promise<void> {
  return downloadAnalysis(plan, "pdf");
}

export function downloadAnalysisCSV(
  plan: AnalysisRequest,
): Promise<void> {
  return downloadAnalysis(plan, "csv");
}

export async function downloadChartExcel(
  plan: AnalysisRequest,
  chartType: ChartMode,
  metricAlias: string,
): Promise<void> {
  const response = await apiFetch("/exports/analysis/xlsx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan,
      chart_type: chartType,
      metric_alias: metricAlias,
    }),
  });

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download =
    `chart-${plan.dataset_id.slice(0, 8)}-${metricAlias}.xlsx`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
