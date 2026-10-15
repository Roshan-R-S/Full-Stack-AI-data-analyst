import { useEffect, useState } from "react";
import UploadZone from "../components/upload/UploadZone";
import DatasetTable from "../components/datasets/DatasetTable";
import ColumnInspector from "../components/datasets/ColumnInspector";

import {
  listDatasets,
  uploadDataset,
  getDatasetPreview,
  getDatasetProfile,
  deleteDataset,
} from "../services/datasetApi";

import type {
  Dataset,
  DatasetPreview,
  DatasetProfile,
} from "../types/dataset";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("[READY]");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    listDatasets()
      .then((items) => {
        if (!active) return;
        setDatasets(items);
        setSelectedId(items[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load datasets",
          );
        }
      });

    return () => { active = false; };
  }, []);

  // Dataset profiling is independent of preview pagination.
  useEffect(() => {
    setProfile(null);

    if (!selectedId) return;

    let active = true;

    getDatasetProfile(selectedId)
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Dataset profiling failed",
          );
        }
      });

    return () => { active = false; };
  }, [selectedId]);

  // Fetch only preview rows when the page changes.
  useEffect(() => {
    setPreview(null);

    if (!selectedId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    getDatasetPreview(selectedId, page)
      .then((nextPreview) => {
        if (active) setPreview(nextPreview);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Dataset preview failed",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [selectedId, page]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    setStatus("[UPLOADING...]");

    try {
      const dataset = await uploadDataset(file);
      setDatasets((existing) => [dataset, ...existing]);
      setSelectedId(dataset.id);
      setPage(1);
      setStatus(`[IMPORTED] ${dataset.filename}`);
    } catch (err) {
      setStatus("[UPLOAD FAILED]");
      throw err;
    } finally {
      setUploading(false);
    }
  }

  function selectDataset(id: string) {
    setSelectedId(id);
    setPage(1);
    setError("");
  }

  async function handleDelete() {
    if (!selectedId) return;

    const dataset = datasets.find((d) => d.id === selectedId);
    if (!dataset) return;

    if (!window.confirm(`Delete dataset "${dataset.filename}"?`)) {
      return;
    }

    try {
      await deleteDataset(selectedId);

      const remaining = datasets.filter(
        (item) => item.id !== selectedId,
      );

      setDatasets(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setPage(1);
      setStatus("[DATASET DELETED]");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete failed",
      );
    }
  }

  const selectedDataset = datasets.find(
    (dataset) => dataset.id === selectedId,
  );

  return (
    <div className="dataset-workspace">
      <UploadZone
        onUpload={handleUpload}
        uploading={uploading}
      />

      <div className="workspace-status" role="status">
        {status}
      </div>

      {error && (
        <p className="inline-error" role="alert">
          [ERROR] {error}
        </p>
      )}

      <div className="workspace-columns">
        <aside className="dataset-sidebar">
          <div className="section-heading">
            <span>STORED DATASETS</span>
            <span>{datasets.length}</span>
          </div>

          {datasets.length === 0 ? (
            <p className="meta-note">
              [NO DATASETS] Upload a CSV to begin.
            </p>
          ) : (
            <div className="dataset-list">
              {datasets.map((dataset, index) => (
                <button
                  type="button"
                  key={dataset.id}
                  className={`dataset-entry ${
                    selectedId === dataset.id ? "selected" : ""
                  }`}
                  onClick={() => selectDataset(dataset.id)}
                >
                  <span className="dataset-entry-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="dataset-entry-info">
                    <strong>{dataset.filename}</strong>
                    <small>
                      {dataset.row_count.toLocaleString()} ROWS /{" "}
                      {dataset.column_count} COLS
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="dataset-main">
          {!selectedDataset ? (
            <div className="empty-workspace">
              <p className="eyebrow">DATA WORKSPACE / EMPTY</p>
              <h2>NO DATA SELECTED.</h2>
              <p>Upload your first CSV to inspect its contents.</p>
            </div>
          ) : (
            <>
              <div className="selected-dataset-heading">
                <div>
                  <p className="eyebrow">ACTIVE DATASET</p>
                  <h2>{selectedDataset.filename}</h2>
                </div>

                <button
                  className="nd-outline danger-action"
                  type="button"
                  onClick={() => void handleDelete()}
                >
                  DELETE
                </button>
              </div>

              <div className="metrics-grid">
                <div className="dataset-metric">
                  <span>ROWS</span>
                  <strong>
                    {selectedDataset.row_count.toLocaleString()}
                  </strong>
                </div>
                <div className="dataset-metric">
                  <span>COLUMNS</span>
                  <strong>{selectedDataset.column_count}</strong>
                </div>
                <div className="dataset-metric">
                  <span>MISSING CELLS</span>
                  <strong>{profile?.missing_cells ?? "—"}</strong>
                </div>
                <div className="dataset-metric">
                  <span>DUPLICATES</span>
                  <strong>{profile?.duplicate_rows ?? "—"}</strong>
                </div>
              </div>

              <DatasetTable
                preview={preview}
                loading={loading}
                page={page}
                onPageChange={setPage}
              />

              <ColumnInspector profile={profile} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}