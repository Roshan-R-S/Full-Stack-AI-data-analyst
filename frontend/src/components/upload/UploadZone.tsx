import { useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { FileUp } from "lucide-react";

interface Props {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
}

export default function UploadZone({
  onUpload,
  uploading,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  async function accept(file?: File) {
    if (!file || uploading) return;

    setError("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("ONLY CSV FILES ARE SUPPORTED");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("MAXIMUM FILE SIZE IS 10 MB");
      return;
    }

    try {
      await onUpload(file);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "UPLOAD FAILED",
      );
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void accept(event.dataTransfer.files[0]);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    void accept(event.target.files?.[0]);
    event.target.value = "";
  }

  return (
    <section className="nd-section">
      <div className="section-heading">
        <span>01 / DATA INGESTION</span>
        <span>CSV ONLY</span>
      </div>

      <div
        className={`upload-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <FileUp size={30} strokeWidth={1.5} aria-hidden="true" />

        <h2>DROP YOUR DATA.</h2>
        <p>Drag a CSV file here or select one from your device.</p>

        <input
          id="csv-file-input"
          className="visually-hidden"
          type="file"
          accept=".csv,text/csv"
          onChange={handleChange}
          disabled={uploading}
        />

        <label
          className={`nd-btn ${uploading ? "disabled" : ""}`}
          htmlFor={uploading ? undefined : "csv-file-input"}
        >
          {uploading ? "[ UPLOADING... ]" : "[ SELECT CSV ]"}
        </label>

        <p className="meta-note">
          UTF-8 / MAX 10 MB / 100K ROWS / 100 COLUMNS
        </p>

        {error && (
          <p className="inline-error" role="alert">
            [ERROR] {error}
          </p>
        )}
      </div>
    </section>
  );
}