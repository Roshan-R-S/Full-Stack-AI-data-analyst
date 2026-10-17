# API Reference

> **Project:** Full Stack AI Data Analyst
> **Status:** Implemented local-development API, reviewed against repository `main` on 2026-10-17.
> **Base URL:** `http://127.0.0.1:8000/api/v1`
> **Interactive documentation:** `http://127.0.0.1:8000/docs`

The backend uses FastAPI, Pydantic, Pandas and SQLite. The Vite development server proxies `/api` to `http://127.0.0.1:8000`, so the React frontend uses the same `/api/v1/...` routes. This is a **single-user, local-only** API: it does not implement account authentication or authorization.

## 1. Conventions

- Request and response bodies are JSON unless otherwise specified; CSV upload is `multipart/form-data`, while exports return file bytes.
- Resource identifiers are UUID strings. Timestamps stored in SQLite are UTC ISO-8601 strings.
- The API returns conventional statuses such as `200` (success), `201` (created), `204` (deleted), `400` (bad request), `403` (blocked origin), `404` (not found), `413` (too large), `422` (invalid request or analysis), `429` (rate limited), `500`, `502` and `503` (service errors).
- Error responses generally have a `detail` field. Pydantic's validation errors can instead provide a structured `detail` array.
- Responses under `/api/` use `Cache-Control: no-store` at the middleware layer.
- Use `http://127.0.0.1:8000` or `http://localhost:8000` for direct requests. The host/origin restrictions are described in [SECURITY.md](SECURITY.md).

## 2. Endpoints at a glance

### System and datasets

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Read service status |
| `POST` | `/datasets` | Upload a CSV file; returns `201` |
| `GET` | `/datasets` | List datasets |
| `GET` | `/datasets/{dataset_id}` | Get dataset metadata |
| `GET` | `/datasets/{dataset_id}/preview` | Page through CSV rows |
| `GET` | `/datasets/{dataset_id}/profile` | Get column and quality profile |
| `DELETE` | `/datasets/{dataset_id}` | Remove a dataset and dependent records; returns `204` |

### Analysis and AI

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/analysis` | Run a validated Pandas analysis |
| `POST` | `/chat/ask` | Ask a natural-language question and save the exchange |

### Persistent conversations

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/conversations` | List recent conversations (optional `dataset_id`) |
| `GET` | `/conversations/{conversation_id}` | Get conversation and messages |
| `PATCH` | `/conversations/{conversation_id}` | Rename conversation |
| `DELETE` | `/conversations/{conversation_id}` | Delete conversation; returns `204` |

### Saved analyses

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/saved-analyses` | Save a validated analysis plan; returns `201` |
| `GET` | `/saved-analyses` | List saved analyses (optional `dataset_id`) |
| `GET` | `/saved-analyses/{analysis_id}` | Get saved analysis with plan |
| `PATCH` | `/saved-analyses/{analysis_id}` | Rename a saved analysis |
| `PUT` | `/saved-analyses/{analysis_id}/plan` | Replace saved analysis plan |
| `POST` | `/saved-analyses/{analysis_id}/run` | Re-run the saved plan on current data |
| `DELETE` | `/saved-analyses/{analysis_id}` | Delete a saved analysis; returns `204` |

### Export

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/exports/analysis/csv` | `AnalysisRequest` | UTF-8-BOM `.csv` attachment |
| `POST` | `/exports/analysis/pdf` | `AnalysisRequest` | PDF report attachment |
| `POST` | `/exports/analysis/xlsx` | `ExcelChartRequest` | `.xlsx` workbook with native chart |

All paths above are relative to `/api/v1`.

## 3. CSV upload, preview and profile

Upload with PowerShell using the real `curl.exe` executable (rather than PowerShell's historical `curl` alias):

```powershell
curl.exe --fail-with-body -F "file=@D:\full-stack-ai-data-analyst\data\samples\sales_sample.csv" http://127.0.0.1:8000/api/v1/datasets
```

The upload response includes `id`, `filename`, `row_count`, `column_count` and `uploaded_at`. Save the returned `id` for later requests.

```http
GET /api/v1/datasets/{dataset_id}/preview?page=1&page_size=20
GET /api/v1/datasets/{dataset_id}/profile
```

- `page` is at least `1`; `page_size` is `1` through `100` (default `20`).
- Preview response: `dataset_id`, `page`, `page_size`, `total_rows`, `columns`, `rows`.
- Profile response: `dataset_id` plus profile fields including `row_count`, `column_count`, `missing_cells`, `duplicate_rows` and per-column `name`, `dtype`, `missing`, `unique`.
- CSV input must be valid UTF-8 and nonempty; enforced limits are **10 MiB uploaded bytes**, **100,000 rows** and **100 columns**. Binary/null-byte inputs are rejected.
- Deleting a dataset also deletes its associated conversation history and saved analyses; deletion is irreversible via the API.

## 4. Deterministic analysis

### `POST /analysis`

An analysis plan is constructed by the editor or AI planner and executed by Pandas. The API does **not** evaluate arbitrary Python or SQL from client input.

Example using columns from `data/samples/sales_sample.csv`:

```json
{
  "dataset_id": "PUT-YOUR-UPLOADED-DATASET-UUID-HERE",
  "filters": [
    {"column": "Region", "operator": "eq", "value": "North"}
  ],
  "group_by": ["Product"],
  "metrics": [
    {"column": "Revenue", "aggregation": "sum", "alias": "total_revenue"}
  ],
  "sort": {"column": "total_revenue", "direction": "desc"},
  "limit": 20
}
```

**Replace the placeholder with an actual UUID** obtained from upload; this example is a request template, not a ready-to-send payload.

### AnalysisRequest validation

| Field | Requirements |
|---|---|
| `dataset_id` | Existing dataset UUID |
| `filters` | Optional; maximum 10 objects |
| `group_by` | Optional; maximum 3 distinct column names |
| `metrics` | Required; 1–5 metric specifications |
| `sort` | Optional column and `asc` / `desc` direction |
| `limit` | Integer `1`–`100`; defaults to `50` |

**Filter operators:** `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`. The `in` operator requires a list of 1–20 values; numerical comparison requires a numeric source column; `contains` is a case-insensitive literal text search.

**Metric aggregations:** `sum`, `mean`, `min`, `max`, `count`, `nunique`. Numeric aggregations require numeric columns. Each metric has a distinct `alias` matching `[A-Za-z_][A-Za-z0-9_]*`, and aliases cannot duplicate grouping columns.

Response shape:

```json
{
  "dataset_id": "UUID-OF-UPLOADED-DATASET",
  "source_rows": 100,
  "matched_rows": 25,
  "result_count": 1,
  "returned_rows": 1,
  "truncated": false,
  "columns": ["Product", "total_revenue"],
  "rows": [{"Product": "Widget A", "total_revenue": 1500}]
}
```

*The numbers in this response are illustrative, not asserted output from the sample CSV.* `result_count` is the number of groups after filtering and aggregation; `returned_rows` is the number actually included after the `limit`. When `truncated: true`, results represent only a subset of groups.

### PowerShell JSON request

```powershell
$datasetId = "REPLACE_WITH_REAL_UUID"
$plan = @{
  dataset_id = $datasetId
  group_by = @("Product")
  metrics = @(@{ column = "Revenue"; aggregation = "sum"; alias = "total_revenue" })
  sort = @{ column = "total_revenue"; direction = "desc" }
  limit = 20
}
$body = $plan | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/analysis" -Method Post -ContentType "application/json" -Body $body
```

## 5. AI analyst and conversations

### `POST /chat/ask`

```json
{
  "dataset_id": "PUT-YOUR-UPLOADED-DATASET-UUID-HERE",
  "question": "Which product has the highest total revenue?",
  "conversation_id": null
}
```

- `question` length: **5–500 characters**.
- `conversation_id` is optional. If supplied, it must point to a conversation belonging to the same dataset.
- Response fields: `question`, `model`, `answer`, `plan`, `analysis`, `conversation_id`.
- For supported quantitative requests, Gemini creates a structured plan; the backend validates it; **Pandas computes the values**; Gemini explains the verified results. A failed AI explanation can fall back to the verified evidence.
- Recognized dataset-overview questions (for example, “What is this data about?”) use a **local deterministic profile** without a Gemini call. These return `model: "local-profile"`, `plan: null`, `analysis: null` and are saved to conversation history.
- The AI planning path supports one metric, at most one grouping column and up to three filters, within the more general `/analysis` endpoint's wider limits.

### Conversation management

```http
GET /api/v1/conversations?dataset_id={dataset_id}
GET /api/v1/conversations/{conversation_id}
PATCH /api/v1/conversations/{conversation_id}
DELETE /api/v1/conversations/{conversation_id}
```

Rename body: `{"title": "Revenue questions"}` (1–120 nonblank characters). The listing is capped at **50** most recently updated conversations. Conversation detail contains a `messages` array, including persisted user and assistant messages and stored plan/analysis data where available.

## 6. Saved analyses

Create:

```json
{
  "name": "Revenue by product",
  "plan": {
    "dataset_id": "PUT-YOUR-UPLOADED-DATASET-UUID-HERE",
    "group_by": ["Product"],
    "metrics": [
      {"column": "Revenue", "aggregation": "sum", "alias": "total_revenue"}
    ],
    "sort": {"column": "total_revenue", "direction": "desc"},
    "limit": 20
  }
}
```

- `name`: 1–120 characters; the backend rejects all-whitespace names.
- `GET /saved-analyses` returns up to **100** items (optional dataset filter).
- `GET /saved-analyses/{analysis_id}` returns metadata and `plan`.
- Rename with `PATCH` and `{"name": "New name"}`.
- Update the complete plan with `PUT /saved-analyses/{analysis_id}/plan` and an `AnalysisRequest` object. A saved analysis cannot be moved to a different dataset via this operation.
- Re-run with `POST /saved-analyses/{analysis_id}/run`; response includes `saved_analysis_id`, `plan`, `analysis`.

## 7. File exports

### CSV and PDF

Send the same `AnalysisRequest` as `/analysis` to:

```http
POST /api/v1/exports/analysis/csv
POST /api/v1/exports/analysis/pdf
```

- CSV contains the verified result columns and rows and is encoded in UTF-8 with BOM, useful for Excel compatibility.
- PDF is a generated report including analysis context, metrics and returned results; it is **not** an Excel workbook.
- Both expose `Content-Disposition` for the suggested filename and `X-Export-Truncated: true|false`.

### Native Excel chart workbook

`POST /exports/analysis/xlsx` accepts:

```json
{
  "plan": {
    "dataset_id": "PUT-YOUR-UPLOADED-DATASET-UUID-HERE",
    "group_by": ["Product"],
    "metrics": [
      {"column": "Revenue", "aggregation": "sum", "alias": "total_revenue"}
    ],
    "limit": 100
  },
  "chart_type": "bar",
  "metric_alias": "total_revenue"
}
```

Available chart types: `bar` (vertical columns in Excel), `horizontal`, `line`, `area`, `pie`, `donut`. The selected `metric_alias` must match an aggregation defined in the plan. A chart requires **exactly one grouping column** and numeric results.

The exported workbook contains:

1. **Chart** — native editable Excel chart plus the chart's source series.
2. **Verified Data** — the returned Pandas analysis rows, with a label if the result is partial.

Pie/donut requires a complete nonnegative `sum` or `count` result with at least two categories and a nonzero total. If more than 12 categories are returned, the top 11 are shown individually and the remainder are grouped as `Other`. Line/area charts require an ordered numeric or recognizable date axis whose grouping column name denotes time/order. Invalid combinations return `422`.

The download button is implemented in **Analysis and Dashboard**, not AI Chat.

## 8. Limits and error handling

| Limit / condition | Implemented behavior |
|---|---|
| CSV upload greater than 10 MiB | `413` |
| More than 100,000 rows / 100 columns | Rejected during CSV validation |
| Non-existent dataset / conversation / saved analysis | Typically `404` |
| Invalid columns, aggregations, filters, chart suitability | `422` |
| Gemini unconfigured | `503` for quantitative AI questions |
| Gemini planning failure | `502` |
| Excessive requests | `429` with `Retry-After` |
| JSON body over 64 KiB / upload HTTP body over 12 MiB | `413` at request guard |

The local request guard applies approximate **per-process, per-operation** rate limits, not user-specific quotas (12 AI asks, 60 analysis calls, 30 exports, 30 saved reruns, 12 uploads per 60 seconds). This is **not authentication**.

## 9. Related documentation

- [Architecture](ARCHITECTURE.md)
- [Database](DATABASE.md)
- [Product requirements](PRD.md)
- [Roadmap](ROADMAP.md)
- [Security](SECURITY.md)
- [Root README](../README.md)
