import { apiJson } from "./api";

import type {
  Dataset,
  DatasetPreview,
  DatasetProfile,
} from "../types/dataset";

export function listDatasets(): Promise<Dataset[]> {
  return apiJson<Dataset[]>("/datasets");
}

export function uploadDataset(file: File): Promise<Dataset> {
  const form = new FormData();
  form.append("file", file);

  return apiJson<Dataset>("/datasets", {
    method: "POST",
    body: form,
  });
}

export function getDatasetPreview(
  id: string,
  page = 1,
): Promise<DatasetPreview> {
  return apiJson<DatasetPreview>(
    `/datasets/${encodeURIComponent(id)}/preview?page=${page}&page_size=20`,
  );
}

export function getDatasetProfile(
  id: string,
): Promise<DatasetProfile> {
  return apiJson<DatasetProfile>(
    `/datasets/${encodeURIComponent(id)}/profile`,
  );
}

export function deleteDataset(id: string): Promise<void> {
  return apiJson<void>(
    `/datasets/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}