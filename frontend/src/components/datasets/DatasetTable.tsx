import type { DatasetPreview } from "../../types/dataset";
import LoadingSkeleton from "../common/LoadingSkeleton";

interface Props {
  preview: DatasetPreview | null;
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
}

export default function DatasetTable({
  preview,
  loading,
  page,
  onPageChange,
}: Props) {
  if (loading) {
    return (
      <LoadingSkeleton variant="table" label="Loading data preview" />
    );
  }

  if (!preview) {
    return <p className="meta-note">[DATA PREVIEW UNAVAILABLE]</p>;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(preview.total_rows / preview.page_size),
  );

  return (
    <section className="nd-section">
      <div className="section-heading">
        <span>DATA / PREVIEW</span>
        <span>{preview.total_rows.toLocaleString()} RECORDS</span>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              {preview.columns.map((column) => (
                <th scope="col" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, index) => (
              <tr key={`${page}-${index}`}>
                <td className="row-number">
                  {(page - 1) * preview.page_size + index + 1}
                </td>
                {preview.columns.map((column) => {
                  const value = row[column];

                  return (
                    <td
                      key={column}
                      className={
                        typeof value === "number"
                          ? "numeric-cell"
                          : undefined
                      }
                    >
                      {value == null ? "—" : String(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>PAGE {page} / {totalPages}</span>
        <div className="pagination-actions">
          <button
            className="nd-outline"
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            PREV
          </button>
          <button
            className="nd-outline"
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            NEXT
          </button>
        </div>
      </div>
    </section>
  );
}