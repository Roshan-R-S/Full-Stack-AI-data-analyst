import type {
  ConversationSummary,
  ConversationDetail,
} from "../types/conversation";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, options);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = (await response.json()) as {
        detail?: unknown;
      };
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Retain the HTTP status error.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function listConversations(datasetId: string) {
  return request<ConversationSummary[]>(
    `/conversations?dataset_id=${encodeURIComponent(datasetId)}`,
  );
}

export function getConversation(id: string) {
  return request<ConversationDetail>(
    `/conversations/${encodeURIComponent(id)}`,
  );
}

export function renameConversation(
  id: string,
  title: string,
) {
  return request<ConversationSummary>(
    `/conversations/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );
}

export function deleteConversation(id: string) {
  return request<void>(
    `/conversations/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}