// @vitest-environment jsdom

import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import VerifiedChart from "./VerifiedChart";
import type { AnalysisResult } from "../../types/analysis";

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

afterEach(cleanup);

function makeResult(count = 2): AnalysisResult {
  return {
    dataset_id: "test-dataset",
    source_rows: count,
    matched_rows: count,
    result_count: count,
    returned_rows: count,
    truncated: false,
    columns: ["Region", "revenue"],
    rows: Array.from({ length: count }, (_, index) => ({
      Region: index === 0
        ? "North Region With A Very Long Label"
        : `Region ${index + 1}`,
      revenue: count - index,
    })),
  };
}

describe("VerifiedChart interactions", () => {
  it("shows a collapsible table of plotted values", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <VerifiedChart
        result={makeResult()}
        groupBy={["Region"]}
        aggregation="sum"
      />,
    );

    const details = container.querySelector(
      ".verified-chart-data",
    ) as HTMLDetailsElement;

    expect(details).not.toBeNull();
    expect(details.open).toBe(false);

    await user.click(
      screen.getByText("VIEW CHART DATA / 2 ROWS"),
    );

    expect(details.open).toBe(true);

    const table = within(details).getByRole("table");

    expect(table.textContent).toContain(
      "North Region With A Very Long Label",
    );
    expect(table.textContent).toContain("Region 2");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("keeps chart data available when switching modes", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <VerifiedChart
        result={makeResult()}
        groupBy={["Region"]}
        aggregation="sum"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "HORIZONTAL" }),
    );

    const chart = screen.getByRole("region", {
      name: "horizontal chart of revenue by Region",
    });

    expect(chart).toBeTruthy();

    const details = container.querySelector(
      ".verified-chart-data",
    ) as HTMLDetailsElement;

    expect(details.textContent).toContain(
      "VIEW CHART DATA / 2 ROWS",
    );
  });

  it("shows grouped Other values for pie charts", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <VerifiedChart
        result={makeResult(13)}
        groupBy={["Region"]}
        aggregation="sum"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "PIE" }),
    );

    const details = container.querySelector(
      ".verified-chart-data",
    ) as HTMLDetailsElement;

    expect(details.textContent).toContain(
      "VIEW CHART DATA / 12 SLICES",
    );

    const table = within(details).getByRole("table");

    expect(table.textContent).toContain(
      "Other (2 categories)",
    );

    expect(within(table).getAllByRole("row")).toHaveLength(13);
  });
});
