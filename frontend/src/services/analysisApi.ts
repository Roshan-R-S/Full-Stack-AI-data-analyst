import type {
  AnalysisRequest,
  AnalysisResult,
} from "../types/analysis";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export async function runAnalysis(
  plan: AnalysisRequest,
): Promise<AnalysisResult> {
  const response = await fetch(`${BASE}/analysis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(plan),
  });

  if (!response.ok) {
    let message = `Analysis failed (${response.status})`;

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

  return response.json() as Promise<AnalysisResult>;
}