// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import {
  ACTIVE_DATASET_KEY,
  readStoredActiveDatasetId,
  reconcileDatasets,
  setActiveDatasetId,
  useActiveDataset,
} from "./activeDataset";

import type { Dataset } from "../types/dataset";

const datasets: Dataset[] = [
  {
    id: "new-dataset",
    filename: "new.csv",
    row_count: 10,
    column_count: 2,
    uploaded_at: "2026-10-18T10:00:00",
  },
  {
    id: "older-dataset",
    filename: "older.csv",
    row_count: 20,
    column_count: 3,
    uploaded_at: "2026-10-17T10:00:00",
  },
];

beforeEach(() => {
  const memory = new Map<string, string>();

  const storage: Storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, String(value));
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
    key: (index) =>
      Array.from(memory.keys())[index] ?? null,
    get length() {
      return memory.size;
    },
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });

  act(() => setActiveDatasetId(""));
});

afterEach(cleanup);

describe("active dataset persistence", () => {
  it("defaults to the newest dataset when none is selected", () => {
    act(() => reconcileDatasets(datasets));

    expect(readStoredActiveDatasetId()).toBe(
      "new-dataset",
    );
  });

  it("remembers an older dataset when selected manually", () => {
    act(() => {
      reconcileDatasets(datasets);
      setActiveDatasetId("older-dataset");
    });

    act(() => reconcileDatasets(datasets));

    expect(readStoredActiveDatasetId()).toBe(
      "older-dataset",
    );
  });

  it("falls back when the selected dataset is deleted", () => {
    act(() => setActiveDatasetId("older-dataset"));

    act(() => reconcileDatasets([datasets[0]]));

    expect(readStoredActiveDatasetId()).toBe(
      "new-dataset",
    );

    act(() => reconcileDatasets([]));

    expect(window.localStorage.getItem(
      ACTIVE_DATASET_KEY,
    )).toBeNull();
  });

  it("keeps multiple mounted consumers synchronized", () => {
    const first = renderHook(() => useActiveDataset());
    const second = renderHook(() => useActiveDataset());

    act(() => setActiveDatasetId("older-dataset"));

    expect(first.result.current.activeDatasetId).toBe(
      "older-dataset",
    );

    expect(second.result.current.activeDatasetId).toBe(
      "older-dataset",
    );
  });
});
