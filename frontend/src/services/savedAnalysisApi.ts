import type { AnalysisRequest } from "../types/analysis";
import type {
  SavedAnalysisSummary,
  SavedAnalysisDetail,
  SavedAnalysisRun,
} from "../types/savedAnalysis";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, options);

  if (!response.ok) {
    let message = `Saved analysis request failed (${response.status})`;

    try {
      const data = (await response.json()) as {
        detail?: unknown;
      };

      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Preserve HTTP status error.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

export function listSavedAnalyses(datasetId: string) {
  return request<SavedAnalysisSummary[]>(
    `/saved-analyses?dataset_id=${encodeURIComponent(datasetId)}`,
  );
}

export function getSavedAnalysis(id: string) {
  return request<SavedAnalysisDetail>(
    `/saved-analyses/${encodeURIComponent(id)}`,
  );
}

export function createSavedAnalysis(
  name: string,
  plan: AnalysisRequest,
) {
  return request<SavedAnalysisDetail>(
    "/saved-analyses",
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name, plan }),
    },
  );
}

export function renameSavedAnalysis(
  id: string,
  name: string,
) {
  return request<SavedAnalysisDetail>(
    `/saved-analyses/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ name }),
    },
  );
}

export function rerunSavedAnalysis(id: string) {
  return request<SavedAnalysisRun>(
    `/saved-analyses/${encodeURIComponent(id)}/run`,
    { method: "POST" },
  );
}

export function deleteSavedAnalysis(id: string) {
  return request<void>(
    `/saved-analyses/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}