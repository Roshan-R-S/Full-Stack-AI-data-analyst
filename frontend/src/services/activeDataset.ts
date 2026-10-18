import { useSyncExternalStore } from "react";
import type { Dataset } from "../types/dataset";

export const ACTIVE_DATASET_KEY =
  "data-analyst:active-dataset-id";

const listeners = new Set<() => void>();
let currentId: string | undefined;

export function readStoredActiveDatasetId(): string {
  try {
    return window.localStorage.getItem(ACTIVE_DATASET_KEY) ?? "";
  } catch {
    return "";
  }
}

function getSnapshot(): string {
  if (currentId === undefined) {
    currentId = readStoredActiveDatasetId();
  }

  return currentId;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function setActiveDatasetId(id: string): void {
  if (id === getSnapshot()) return;

  currentId = id;

  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_DATASET_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_DATASET_KEY);
    }
  } catch {
    // Keep in-memory selection working if storage is disabled.
  }

  listeners.forEach((listener) => listener());
}

export function reconcileDatasets(datasets: Dataset[]): void {
  const selected = getSnapshot();

  if (datasets.some((dataset) => dataset.id === selected)) {
    return;
  }

  setActiveDatasetId(datasets[0]?.id ?? "");
}

export function useActiveDataset() {
  const activeDatasetId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "",
  );

  return {
    activeDatasetId,
    setActiveDatasetId,
    reconcileDatasets,
  };
}
