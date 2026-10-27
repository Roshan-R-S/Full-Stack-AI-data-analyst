import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "../../types/analysis";
import VerifiedChart from "./VerifiedChart";

vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return Object.fromEntries(
    [
      "ResponsiveContainer", "BarChart", "Bar",
      "LineChart", "Line", "AreaChart", "Area",
      "PieChart", "Pie", "Cell", "CartesianGrid",
      "XAxis", "YAxis", "Tooltip",
    ].map((name) => [name, Stub]),
  );
});

const result: AnalysisResult = {
  dataset_id: "00000000-0000-0000-0000-000000000001",
  source_rows: 10,
  matched_rows: 10,
  result_count: 2,
  returned_rows: 2,
  truncated: false,
  columns: ["Region", "total_revenue"],
  rows: [
    { Region: "North", total_revenue: 600 },
    { Region: "South", total_revenue: 400 },
  ],
};

function render(data: AnalysisResult = result) {
  return renderToStaticMarkup(
    <VerifiedChart
      result={data}
      groupBy={["Region"]}
      aggregation="sum"
    />,
  );
}

function readableText(html: string) {
  return html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("Verified chart accessibility", () => {
  it("links a useful description to the chart", () => {
    const html = render();

    const describedBy =
      html.match(/aria-describedby="([^"]+)"/);

    expect(describedBy).not.toBeNull();
    expect(html).toContain(`id="${describedBy?.[1]}"`);
    expect(html).toContain(
      'aria-label="bar chart of total_revenue by Region"',
    );

    const text = readableText(html);

    expect(text).toMatch(
      /bar visualization showing 2 categories of total_revenue grouped by Region/,
    );
    expect(text).toContain("Aggregation: sum.");
  });

  it("aligns numeric headers", () => {
    const html = render();

    expect(html).toContain(
      'class="numeric-cell">total_revenue</th>',
    );
  });

  it("can omit redundant chart tables", () => {
    const html = renderToStaticMarkup(
      <VerifiedChart
        result={result}
        groupBy={["Region"]}
        aggregation="sum"
        showDataTable={false}
      />,
    );

    expect(html).not.toContain("verified-chart-data");
    expect(html).toContain("verified-chart-note");
  });

  it("announces partial analytical results", () => {
    const html = render({
      ...result,
      result_count: 5,
      truncated: true,
    });

    expect(readableText(html)).toContain(
      "Partial results: 2 of 5 groups returned.",
    );
  });
});
