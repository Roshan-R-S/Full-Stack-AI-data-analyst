import { apiJson } from "./api";
import type { AskResponse } from "../types/chat";

export function askAI(
  datasetId: string,
  question: string,
  signal?: AbortSignal,
  conversationId?: string | null,
): Promise<AskResponse> {
  return apiJson<AskResponse>("/chat/ask", {
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
}