import { apiJson } from "./api";

import type { AnalysisRequest } from "../types/analysis";

import type {
  SavedAnalysisSummary,
  SavedAnalysisDetail,
  SavedAnalysisRun,
} from "../types/savedAnalysis";

const jsonHeaders = {
  "Content-Type": "application/json",
};

export function listSavedAnalyses(datasetId: string) {
  return apiJson<SavedAnalysisSummary[]>(
    `/saved-analyses?dataset_id=${encodeURIComponent(datasetId)}`,
  );
}

export function getSavedAnalysis(id: string) {
  return apiJson<SavedAnalysisDetail>(
    `/saved-analyses/${encodeURIComponent(id)}`,
  );
}

export function createSavedAnalysis(
  name: string,
  plan: AnalysisRequest,
) {
  return apiJson<SavedAnalysisDetail>(
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
  return apiJson<SavedAnalysisDetail>(
    `/saved-analyses/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ name }),
    },
  );
}

export function rerunSavedAnalysis(id: string) {
  return apiJson<SavedAnalysisRun>(
    `/saved-analyses/${encodeURIComponent(id)}/run`,
    { method: "POST" },
  );
}

export function deleteSavedAnalysis(id: string) {
  return apiJson<void>(
    `/saved-analyses/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}