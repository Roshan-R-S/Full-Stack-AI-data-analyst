export interface Dataset {
  id: string;
  filename: string;
  row_count: number;
  column_count: number;
  uploaded_at: string;
}

export type CellValue = string | number | boolean | null;

export interface DatasetPreview {
  dataset_id: string;
  page: number;
  page_size: number;
  total_rows: number;
  columns: string[];
  rows: Record<string, CellValue>[];
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  missing: number;
  unique: number;
  statistics?: {
    min: number;
    max: number;
    mean: number;
    sum: number;
  };
  top_values?: Array<{ value: string; count: number }>;
}

export interface DatasetProfile {
  dataset_id: string;
  row_count: number;
  column_count: number;
  missing_cells: number;
  duplicate_rows: number;
  columns: ColumnProfile[];
}