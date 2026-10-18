<div align="center">

# DATA / ANALYST

**FROM CSV TO VERIFIED INSIGHT.**

[![CI](https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst/actions/workflows/ci.yml/badge.svg)](https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst/actions/workflows/ci.yml)

A local-first AI data analyst built with **React, TypeScript, FastAPI, Pandas, SQLite, and Google Gemini**.

Upload a CSV. Explore the data. Run reproducible calculations. Ask questions in natural language. Visualize and export the results.

**`01 / DATASETS` · `02 / ANALYSIS` · `03 / AI CHAT` · `04 / DASHBOARD`**

[Getting Started](#getting-started) · [Features](#features) · [Architecture](#architecture) · [API Reference](#api-reference)

</div>

---

## Overview

DATA / ANALYST is a **single-user, local-development application** that combines deterministic analytics with an AI-assisted interface. Its design takes inspiration from Nothing's typography-led, high-contrast aesthetic, using restrained accents, compact controls, and smooth navigation.

**The central principle:** Gemini interprets supported questions and explains results; **Pandas performs the calculations**. AI-generated analytical plans are validated before execution, and returned figures come from the uploaded dataset—not from model-generated arithmetic.

## Features

| Workspace | Capabilities |
| --- | --- |
| **01 / Datasets** | Drag-and-drop CSV upload, dataset list and deletion, paginated record preview, column profiling, missing/unique values, duplicate-row counts |
| **02 / Analysis** | Grouping, filtering, sorting, six aggregation functions, saved analysis configurations, reproducible result tables, CSV/PDF/Excel exports |
| **03 / AI Chat** | Natural-language analytical questions, local dataset-overview responses, verified Pandas evidence, applicable visualizations, persistent conversation history |
| **04 / Dashboard** | Compact KPI cards, grouped analytics, six chart types, individual Excel downloads, and multi-chart Excel exports |

### Verified analytics

- Aggregations: `sum`, `mean`, `min`, `max`, `count`, `nunique`.
- Filters: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`.
- Grouped and ungrouped operations, sorting, and bounded result limits.
- Validated column references and metric types before executing a plan.
- Saved analyses can be named, loaded, updated, rerun, renamed, and deleted.
- Repeated reads benefit from a bounded, invalidation-aware in-memory CSV cache.

### AI analyst

For supported quantitative questions, the flow is:

1. The application sends the question and relevant dataset schema to Gemini.
2. Gemini proposes a structured analysis plan (not executable Python or SQL).
3. The backend validates the plan against the real dataset.
4. Pandas computes the verified result.
5. Gemini explains a bounded set of the computed results.
6. The UI displays the explanation, evidence table, and an applicable chart.

Common dataset-overview prompts, such as **“What is this data about?”** and **“Describe this dataset”**, are answered locally using dataset profiling without a Gemini call. Other questions depend on the planner's supported analytical operations and the configured API quota.

AI Chat conversations and messages are saved in local SQLite storage. Users can reopen, rename, or delete conversations.

### Interactive visualizations

Charts use **Recharts** and are lazy-loaded to reduce initial frontend loading costs.

| Chart | Best suited to |
| --- | --- |
| Vertical bar | Comparing numerical results across categories |
| Horizontal bar | Comparing categories with longer labels |
| Line | Ordered or time-based changes |
| Area | Ordered trends with visual emphasis on magnitude |
| Pie | Shares of a complete, additive total |
| Donut | Compact presentation of those same proportions |

The application only offers chart modes appropriate for the returned data. In particular, Pie/Donut charts require **complete, nonnegative `sum` or `count` results**; averages should not be interpreted as parts of a total. Large Pie/Donut views combine smaller categories into an **Other** slice while preserving their combined value.

The UI includes distinct slice colors, tooltips, smooth module transitions, scrollable dataset panels, and reduced-motion support.

### Export formats

| Format | Contents | Workspace |
| --- | --- | --- |
| CSV | Verified analysis results | Analysis |
| PDF | Formatted analysis report | Analysis |
| Single-chart Excel | One editable Excel chart | Analysis and Dashboard |
| Multi-chart Excel | 2-6 editable charts in one workbook | Dashboard and API |

### Multi-chart Excel export

The Dashboard can export 2-6 native, editable charts into one Excel workbook.

1. Upload or select a dataset.
2. Open Dashboard and configure your analysis.
3. Click UPDATE DASHBOARD.
4. Find EXPORT MULTIPLE CHARTS.
5. Choose a metric and chart type for each chart.
6. Use ADD CHART to include additional charts.
7. Click EXPORT CHARTS TO EXCEL.

The workbook contains three worksheets:

| Worksheet | Contents |
| --- | --- |
| Charts | All selected Excel charts on one sheet |
| Chart Data | Source values for the charts |
| Verified Data | Pandas-calculated analysis results |

Supported types: Bar, Horizontal, Line, Area, Pie and Donut.

Pie and Donut require complete, nonnegative SUM or COUNT results
with at least two groups and a positive total. Line and Area
require an ordered numeric or date-like grouping axis.

The selector disables ineligible options and prevents duplicate
metric/chart combinations. Excel export includes safeguards
against formula injection.

Exports use backend-computed results and respect analysis
row limits. They do not necessarily contain the entire CSV.

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8 |
| Charts | Recharts |
| Styling | Tailwind CSS 4, custom CSS, Nothing-inspired visual language |
| Backend | Python 3.12, FastAPI |
| Data processing | Pandas, NumPy |
| AI integration | Google Gemini via `google-genai` |
| Persistence | SQLite, SQLAlchemy |
| Reports and spreadsheets | ReportLab, XlsxWriter |
| Python dependency management | `uv` |
| Quality checks | pytest, Vitest, Ruff, TypeScript |

## Architecture

```text
                       React + TypeScript + Vite
                       /         |           \
                Datasets     Analysis       AI Chat
                    \           |             /
                     Dashboard + Recharts UI
                                |
                         FastAPI /api/v1
                                |
           +--------------------+------------------+
           |                    |                  |
    CSV storage/cache     Validated Pandas    Gemini planner
           |               analytics           + explainer
           |                    |                  |
           +--------------------+------------------+
                                |
                          SQLite metadata,
                        conversations, saved plans
                                |
                          CSV / PDF / XLSX
```

- **Local dataset storage:** `data/uploads/`.
- **Application database:** `data/app.db`.
- **Sample CSV:** `data/samples/sales_sample.csv`.
- **CSV cache:** in memory, limited to two datasets and 64 MiB of cached DataFrame memory.

The full uploaded CSV is not automatically sent to Gemini during a supported analytical question. **The question, dataset column names/types, row count, and up to ten verified result rows may be sent to the Gemini API** during planning and explanation. Do not use sensitive data without considering that external API transfer.

---

## Getting Started

The commands below target **Windows PowerShell**, from the repository root. This project currently runs **locally**; it is not configured as a publicly hosted multi-user service.

### Prerequisites

- Git
- Python **3.12** (managed locally through `uv` if desired)
- `uv` ([installation instructions](https://docs.astral.sh/uv/getting-started/installation/))
- Node.js and npm (a current compatible LTS version)
- A Google Gemini API key **for AI-powered analytical questions**; local dataset profiling and manual Pandas analysis do not require an AI key

### 1. Clone

```powershell
git clone https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst.git
Set-Location .\Full-Stack-AI-data-analyst
```

### 2. Install backend dependencies

```powershell
uv python install 3.12
uv sync --project .\backend --python 3.12
```

### 3. Configure Gemini (optional for non-AI workflows)

```powershell
Copy-Item .\backend\.env.example .\backend\.env
notepad .\backend\.env
```

Set the values you intend to use:

```dotenv
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=your_supported_gemini_model
```

The app reads `backend/.env` for Gemini configuration. `GEMINI_MODEL` is optional; if omitted, the backend uses its configured default. **Never commit a real API key or `.env` file.**

### 4. Start the backend

In the first PowerShell terminal, at the repository root:

```powershell
uv run --project .\backend uvicorn app.main:app --app-dir .\backend --reload --host 127.0.0.1 --port 8000
```

- Health check: <http://127.0.0.1:8000/api/v1/health>
- FastAPI docs: <http://127.0.0.1:8000/docs>

### 5. Start the frontend

Open a **second PowerShell terminal** at the repository root:

```powershell
npm.cmd --prefix .\frontend install
npm.cmd --prefix .\frontend run dev
```

Open **<http://localhost:5173/>** in a browser.

### 6. Try the sample dataset

1. Open Datasets and upload `data/samples/sales_sample.csv`.
2. Inspect the column profile and data preview.
3. In Analysis, group by Product and calculate SUM of Revenue.
4. Open Dashboard and explore the visualizations.
5. Under EXPORT MULTIPLE CHARTS, select two or more charts.
6. Download the Excel workbook.
7. Inspect Charts, Chart Data, and Verified Data in Excel.
8. Try Pie or Donut with an eligible COUNT metric.
9. If Gemini is configured, ask a supported data question.

---

## Testing and Quality Checks

Run from the project root:

```powershell
uv run --project .\backend ruff check .\backend\app .\backend\tests
uv run --project .\backend pytest -q
npm.cmd --prefix .\frontend run test
npm.cmd --prefix .\frontend run build
```

### Latest verified results

18 October 2026:

| Check | Result |
| --- | --- |
| Backend pytest | 83 passed |
| Frontend Vitest | 40 passed |
| Ruff lint | Passed |
| TypeScript and Vite | Passed |
| GitHub Actions CI | Working |

One non-blocking Starlette/httpx deprecation warning
was reported by the backend tests.

### GitHub Actions

Automated CI is configured in `.github/workflows/ci.yml`.

The backend job runs Python 3.12, Ruff and pytest.
The frontend job runs Node.js 22, Vitest and Vite build.

CI runs on pushes to main, pull requests, and manual dispatch.

[View GitHub Actions](https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst/actions)

## API Reference

Interactive endpoint documentation is available at `/docs`. All routes below are relative to the local backend and prefixed with `/api/v1`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check |
| `GET`, `POST` | `/datasets` | List or upload CSV datasets |
| `GET`, `DELETE` | `/datasets/{id}` | Dataset details or deletion |
| `GET` | `/datasets/{id}/preview` | Paginated data preview |
| `GET` | `/datasets/{id}/profile` | Column and dataset profiling |
| `POST` | `/analysis` | Execute validated Pandas analysis |
| `POST` | `/chat/ask` | AI-supported analysis or local dataset overview |
| `GET` | `/conversations` | List stored conversations |
| `GET`, `PATCH`, `DELETE` | `/conversations/{id}` | View, rename, or delete a conversation |
| `GET`, `POST` | `/saved-analyses` | List or create saved analytical plans |
| `GET`, `PATCH`, `DELETE` | `/saved-analyses/{id}` | View, rename, or delete a saved plan |
| `PUT` | `/saved-analyses/{id}/plan` | Update a saved analysis plan |
| `POST` | `/saved-analyses/{id}/run` | Rerun a saved analysis |
| `POST` | `/exports/analysis/csv` | Export computed results as CSV |
| `POST` | `/exports/analysis/pdf` | Export a formatted PDF report |
| `POST` | `/exports/analysis/xlsx` | Single editable Excel chart |
| `POST` | `/exports/analysis/xlsx/multi` | 2-6 chart types for one metric |
| `POST` | `/exports/analysis/xlsx/dashboard` | 2-6 metric/chart combinations |

The single-chart endpoint accepts `plan`, `chart_type` and `metric_alias`. The multi-chart endpoint accepts `plan`, `chart_types` and `metric_alias`. The Dashboard endpoint accepts `plan` and a `charts` array containing `chart_type` and `metric_alias`. See `/docs` for request schemas.

## Project Structure

```text
Full-Stack-AI-data-analyst/
├── backend/
│   ├── app/
│   │   ├── ai/               # Gemini client, planner, explanations
│   │   ├── analytics/        # CSV parsing, validation, Pandas execution
│   │   ├── api/v1/           # REST endpoints
│   │   ├── core/             # Local security and request limits
│   │   ├── db/               # SQLite connection and session
│   │   ├── models/           # Persistence models
│   │   ├── schemas/          # Request/response schemas
│   │   └── services/         # Caching, profiling, PDF/XLSX generation
│   ├── tests/                # Unit and integration tests
│   ├── .env.example
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── components/      # Dataset, chat, and chart components
│       ├── pages/           # Four main workspaces
│       ├── services/        # Backend API clients
│       └── types/           # Shared TypeScript types
├── data/
│   ├── samples/             # Example datasets
│   ├── uploads/             # Local uploaded CSVs (runtime)
│   └── app.db               # Local SQLite database (runtime)
└── README.md
```

## Scope, Limits, and Security

This is a **local-first, single-user MVP**, not a production-hardened service.

- CSV input is limited to **10 MiB**, **100,000 rows**, and **100 columns**. Input must be parseable UTF-8 CSV.
- Analytical outputs have bounded result limits; chart and export results may therefore be partial.
- AI questions are limited to the structured operations implemented by the planner. Not every natural-language request is supported.
- Persistent conversations, saved analyses, and uploaded files live on the local machine; back them up as needed.
- The backend includes localhost host/origin restrictions, request-size limits, and rate limiting. **These are not authentication or user isolation.**
- Do not expose this application publicly or process sensitive data without additional security controls and review.
- Google Gemini API requests require a configured key and available quota. The AI features are not fully offline.

## Roadmap

- [x] Local FastAPI + React application foundation
- [x] CSV upload, validation, pagination, and dataset profiling
- [x] Verified Pandas analytics and natural-language AI planning
- [x] Persistent chat conversations and saved analyses
- [x] Dashboard KPIs and six selectable chart types
- [x] Colorful Pie/Donut charts with grouped smaller categories
- [x] CSV, PDF, and editable Excel chart exports
- [x] Multi-chart Excel export
- [x] Compact Dashboard buttons and KPI cards
- [x] GitHub Actions CI for backend and frontend
- [x] Bounded CSV caching and regression tests
- [x] Smooth navigation and reduced-motion support
- [ ] Add real application screenshots and a short walkthrough/demo
- [ ] Expand frontend interaction and accessibility tests
- [ ] Further performance, security, and usability audits
- [ ] Evaluate deployment architecture and controls before public hosting

---

## Author

**Roshan RS** · [GitHub](https://github.com/Roshan-R-S)

[Repository](https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst)

**Built for clarity, reproducibility, and more accessible data analysis.**
