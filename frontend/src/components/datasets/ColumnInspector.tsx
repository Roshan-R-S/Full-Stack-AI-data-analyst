import type { DatasetProfile } from "../../types/dataset";

interface Props {
  profile: DatasetProfile | null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ColumnInspector({ profile }: Props) {
  if (!profile) return null;

  return (
    <section className="nd-section">
      <div className="section-heading">
        <span>SCHEMA / INSPECTOR</span>
        <span>{profile.column_count} COLUMNS</span>
      </div>

      <div className="column-list">
        {profile.columns.map((column, index) => (
          <div className="column-item" key={`${index}-${column.name}`}>
            <div className="column-primary">
              <span className="column-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{column.name}</strong>
              <span className="type-chip">{column.dtype}</span>
            </div>

            <div className="column-metadata">
              <span>UNIQUE {column.unique}</span>
              <span>MISSING {column.missing}</span>
            </div>

            {column.statistics && (
              <div className="column-stats">
                <span>
                  MIN {formatNumber(column.statistics.min)}
                </span>
                <span>
                  MAX {formatNumber(column.statistics.max)}
                </span>
                <span>
                  MEAN {formatNumber(column.statistics.mean)}
                </span>
                <span>
                  SUM {formatNumber(column.statistics.sum)}
                </span>
              </div>
            )}

            {!column.statistics && column.top_values && (
              <p className="column-examples">
                TOP VALUES:{" "}
                {column.top_values
                  .slice(0, 3)
                  .map((v) => `${v.value} (${v.count})`)
                  .join(" / ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}