export type Aggregation =
  | "sum"
  | "mean"
  | "min"
  | "max"
  | "count"
  | "nunique";

export type FilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains";

export interface AnalysisRequest {
  dataset_id: string;
  group_by: string[];
  metrics: Array<{
    column: string;
    aggregation: Aggregation;
    alias: string;
  }>;
  filters: Array<{
    column: string;
    operator: FilterOperator;
    value: string | number | Array<string | number>;
  }>;
  sort: {
    column: string;
    direction: "asc" | "desc";
  };
  limit: number;
}

export interface AnalysisResult {
  dataset_id: string;
  source_rows: number;
  matched_rows: number;
  result_count: number;
  returned_rows: number;
  truncated: boolean;
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
}