import { apiJson } from "./api";

import type {
  AnalysisRequest,
  AnalysisResult,
} from "../types/analysis";

export function runAnalysis(
  plan: AnalysisRequest,
): Promise<AnalysisResult> {
  return apiJson<AnalysisResult>("/analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(plan),
  });
}