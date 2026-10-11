import type { AskResponse } from "../types/chat";

const BASE =
  import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export async function askAI(
  datasetId: string,
  question: string,
  signal?: AbortSignal,
  conversationId?: string | null,
): Promise<AskResponse> {
  const response = await fetch(`${BASE}/chat/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dataset_id: datasetId,
      question,
      ...(conversationId
        ? { conversation_id: conversationId }
        : {}),
    }),
    signal,
  });

  if (!response.ok) {
    let message = `AI request failed (${response.status})`;

    try {
      const body = (await response.json()) as {
        detail?: unknown;
      };

      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Preserve the HTTP status error.
    }

    throw new Error(message);
  }

  return response.json() as Promise<AskResponse>;
}