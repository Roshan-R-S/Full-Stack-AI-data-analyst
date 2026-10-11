import { apiJson } from "./api";

import type {
  ConversationSummary,
  ConversationDetail,
} from "../types/conversation";

export function listConversations(datasetId: string) {
  return apiJson<ConversationSummary[]>(
    `/conversations?dataset_id=${encodeURIComponent(datasetId)}`,
  );
}

export function getConversation(id: string) {
  return apiJson<ConversationDetail>(
    `/conversations/${encodeURIComponent(id)}`,
  );
}

export function renameConversation(
  id: string,
  title: string,
) {
  return apiJson<ConversationSummary>(
    `/conversations/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );
}

export function deleteConversation(id: string) {
  return apiJson<void>(
    `/conversations/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}