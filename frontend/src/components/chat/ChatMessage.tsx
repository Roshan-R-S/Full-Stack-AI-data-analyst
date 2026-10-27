import ReactMarkdown from "react-markdown";
import VerifiedChart from "../charts/LazyVerifiedChart";
import type { ChatEntry } from "../../types/chat";

interface Props {
  message: ChatEntry;
}

function formatValue(value: unknown): string {
  if (value == null) return "—";

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value);
  }

  return String(value);
}

export default function ChatMessage({ message }: Props) {
  const analysis = message.analysis;

  return (
    <article className={`chat-entry ${message.role}`}>
      <div className="chat-entry-label">
        <span>
          {message.role === "assistant"
            ? "AI / ANALYST"
            : "YOU / QUESTION"}
        </span>

        {message.model && <span>{message.model}</span>}
      </div>

      <div className="chat-entry-content">
        {message.role === "assistant" ? (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        ) : (
          <p>{message.content}</p>
        )}
      </div>

      {analysis && (
        <section className="chat-evidence">
          <div className="section-heading">
            <span>VERIFIED / PANDAS RESULTS</span>
            <span>{analysis.matched_rows.toLocaleString()} MATCHED</span>
          </div>

          <VerifiedChart
            showDataTable={false}
            result={analysis}
            groupBy={message.plan?.group_by}
            aggregation={message.plan?.metrics[0]?.aggregation}
          />

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {analysis.columns.map((column) => (
                    <th
  key={column}
  scope="col"
  className={analysis.rows.some(
    (row) => typeof row[column] === "number",
  ) ? "numeric-cell" : undefined}
>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map((row, index) => (
                  <tr key={index}>
                    {analysis.columns.map((column) => (
                      <td
                        key={column}
                        className={
                          typeof row[column] === "number"
                            ? "numeric-cell"
                            : undefined
                        }
                      >
                        {formatValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="chat-evidence-note">
            [RETURNED {analysis.returned_rows} OF{" "}
            {analysis.result_count} RESULT GROUPS]
            {analysis.truncated && " [LIMIT APPLIED]"}
          </p>
        </section>
      )}
    </article>
  );
}