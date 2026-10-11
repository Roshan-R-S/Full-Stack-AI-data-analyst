import type {
  Dataset,
  DatasetPreview,
  DatasetProfile,
} from "../types/dataset";

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
      // Use the HTTP status message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function listDatasets() {
  return request<Dataset[]>("/datasets");
}

export function uploadDataset(file: File) {
  const form = new FormData();
  form.append("file", file);

  return request<Dataset>("/datasets", {
    method: "POST",
    body: form,
  });
}

export function getDatasetPreview(
  id: string,
  page = 1,
) {
  return request<DatasetPreview>(
    `/datasets/${encodeURIComponent(id)}/preview?page=${page}&page_size=20`,
  );
}

export function getDatasetProfile(id: string) {
  return request<DatasetProfile>(
    `/datasets/${encodeURIComponent(id)}/profile`,
  );
}

export async function deleteDataset(id: string) {
  const response = await fetch(
    `${BASE}/datasets/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    throw new Error(`Delete failed (${response.status})`);
  }
}