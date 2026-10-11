import type { AnalysisRequest } from "../types/analysis";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export async function downloadAnalysisPDF(
  plan: AnalysisRequest,
): Promise<void> {
  const response = await fetch(
    `${BASE}/exports/analysis/pdf`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    },
  );

  if (!response.ok) {
    let message = `PDF export failed (${response.status})`;

    try {
      const body = (await response.json()) as {
        detail?: unknown;
      };
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Keep the HTTP status error.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `report-${plan.dataset_id.slice(0, 8)}.pdf`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function downloadAnalysisCSV(
  plan: AnalysisRequest,
): Promise<void> {
  const response = await fetch(
    `${BASE}/exports/analysis/csv`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(plan),
    },
  );

  if (!response.ok) {
    let message = `CSV export failed (${response.status})`;

    try {
      const body = (await response.json()) as {
        detail?: unknown;
      };

      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Keep the HTTP error message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    `analysis-${plan.dataset_id.slice(0, 8)}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}