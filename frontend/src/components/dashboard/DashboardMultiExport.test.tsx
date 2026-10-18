// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DashboardMultiExport from "./DashboardMultiExport";
import { downloadDashboardExcel } from "../../services/exportApi";
import type { AnalysisRequest, AnalysisResult } from "../../types/analysis";

vi.mock("../../services/exportApi", () => ({
  downloadDashboardExcel: vi.fn(),
}));

const plan: AnalysisRequest = {
  dataset_id: "00000000-0000-0000-0000-000000000901",
  group_by: ["Region"],
  metrics: [
    { column: "Revenue", aggregation: "mean", alias: "primary_value" },
    { column: "Region", aggregation: "count", alias: "group_count" },
  ],
  filters: [],
  sort: { column: "primary_value", direction: "desc" },
  limit: 100,
};

const result: AnalysisResult = {
  dataset_id: plan.dataset_id,
  source_rows: 3,
  matched_rows: 3,
  result_count: 2,
  returned_rows: 2,
  truncated: false,
  columns: ["Region", "primary_value", "group_count"],
  rows: [
    { Region: "North", primary_value: 30, group_count: 2 },
    { Region: "South", primary_value: 20, group_count: 1 },
  ],
};

const metrics = [
  { alias: "primary_value", label: "MEAN / Revenue", aggregation: "mean" as const },
  { alias: "group_count", label: "COUNT / Region", aggregation: "count" as const },
];

function setup() {
  render(
    <DashboardMultiExport
      plan={plan}
      result={result}
      group="Region"
      metrics={metrics}
    />,
  );
}

beforeEach(() => {
  vi.mocked(downloadDashboardExcel).mockReset();
  vi.mocked(downloadDashboardExcel).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("Dashboard multi-chart Excel export", () => {
  it("exports two different metrics in one request", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", {
      name: /EXPORT 2 CHARTS TO EXCEL/i,
    }));

    await waitFor(() => expect(downloadDashboardExcel).toHaveBeenCalledWith(
      plan,
      [
        { metric_alias: "primary_value", chart_type: "bar" },
        { metric_alias: "group_count", chart_type: "horizontal" },
      ],
    ));
  });

  it("supports adding a third chart", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /ADD CHART/i }));
    fireEvent.click(screen.getByRole("button", {
      name: /EXPORT 3 CHARTS TO EXCEL/i,
    }));

    await waitFor(() => expect(downloadDashboardExcel).toHaveBeenCalledWith(
      plan,
      [
        { metric_alias: "primary_value", chart_type: "bar" },
        { metric_alias: "group_count", chart_type: "horizontal" },
        { metric_alias: "primary_value", chart_type: "horizontal" },
      ],
    ));
  });

  it("blocks duplicate metric and chart combinations", () => {
    setup();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Chart 2 metric" }),
      { target: { value: "primary_value" } },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Chart 2 type" }),
      { target: { value: "bar" } },
    );

    const button = screen.getByRole("button", {
      name: /EXPORT 2 CHARTS TO EXCEL/i,
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });

  it("disables pie charts for averages", () => {
    setup();

    const typeSelect = screen.getByRole("combobox", {
      name: "Chart 1 type",
    });

    const pie = within(typeSelect).getByRole(
      "option", { name: /PIE/ },
    ) as HTMLOptionElement;

    expect(pie.disabled).toBe(true);
  });
  it("enables pie and donut for complete count results", () => {
    setup();

    const selector = screen.getByRole("combobox", {
      name: "Chart 2 type",
    });

    for (const mode of ["PIE", "DONUT"]) {
      const option = within(selector).getByRole(
        "option", { name: mode },
      ) as HTMLOptionElement;

      expect(option.disabled).toBe(false);
    }
  });

});
