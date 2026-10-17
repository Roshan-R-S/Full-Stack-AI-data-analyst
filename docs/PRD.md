# Product Requirements Document (PRD)

**Product:** Full Stack AI Data Analyst
**Product type:** Local-first single-user CSV analytics workspace
**Document status:** Retrospective specification of the implemented MVP, with explicitly identified future requirements
**Baseline:** Repository `main`, reviewed 2026-10-17
**Owner:** Roshan RS

## 1. Product summary

Full Stack AI Data Analyst enables a user to upload CSV data, explore quality/structure, execute reproducible Pandas calculations, ask supported questions using Gemini-assisted planning, save analyses and conversations, inspect visualizations, and export verified results.

### Product principle

> **The LLM proposes and explains; Pandas calculates.** Numerical conclusions must be traceable to validated, deterministic operations over the uploaded data.

The application is a portfolio-ready **local development MVP**. It is not currently a SaaS platform, an authenticated multi-user system or a general-purpose autonomous data-science agent.

## 2. Problem and opportunity

CSV exploration often requires writing scripts or spreadsheets before a non-specialist can understand the shape of a dataset and ask basic analytical questions. Pure chat interfaces can also produce unsupported quantitative claims. This project reduces the initial friction while protecting the boundary between language-based planning and executed calculations.

### Intended users

- **Data-analysis learners** exploring filtering, grouping, aggregations and evidence-backed answers.
- **Developers and technical reviewers** evaluating a full-stack AI + data application.
- **Individual analysts** prototyping small-to-moderate CSV investigations on their own machine.

### Current scope

- **In:** CSV upload, profile, preview, deterministic analysis, AI chat, history, saved plans, dashboard, charts, reports, local security controls.
- **Out:** Multi-user accounts, permissions, multi-tenancy, hosted collaboration, background job orchestration, large-scale distributed processing, unrestricted SQL/Python execution, regulated-data assurances.

## 3. Goals and measures

| ID | Goal | Evidence/measurement |
|---|---|---|
| G-01 | Make CSV structure understandable | Preview, column types, missing values, duplicates and overall counts |
| G-02 | Produce trustworthy numeric answers | Validated analysis plans, Pandas execution, result/evidence metadata |
| G-03 | Reduce repetitive effort | Persistent chat, saved analyses and an in-process CSV cache |
| G-04 | Enable effective comparison | Dashboard controls, tables, six eligible chart modes |
| G-05 | Support sharing/reworking results | CSV, PDF and editable native Excel chart exports |
| G-06 | Keep local development safe by default | Local host/origin checks, bounded inputs/rates and formula-safe exports |
| G-07 | Demonstrate maintainable engineering | Automated tests, Ruff, Vite production build, Git history and documentation |

No performance SLA, latency guarantee or user-adoption metric has been measured for this MVP; future performance targets should be benchmarked rather than asserted.

## 4. User journeys

### Journey A — Explore a dataset

1. User selects the Datasets module and uploads a supported CSV.
2. The backend validates content/size, stores the original CSV and registers metadata.
3. User views row/column counts, preview rows, column data types and data-quality statistics.
4. User chooses to continue to Analysis, AI Chat or Dashboard, or deletes a dataset.

**Acceptance criteria:** Invalid file types and malformed/oversized CSVs are rejected; paginated preview and profile are derived from the uploaded file; deletion also removes related saved records.

### Journey B — Build an analysis

1. User selects a dataset, grouping, metrics, filters, optional ordering and result limit.
2. The analysis endpoint validates the plan and runs Pandas calculations.
3. User sees the actual returned rows, source/matched counts and any truncation indicator.
4. User can save a named plan, rerun it and export CSV/PDF; where chart-eligible, export native Excel charts.

**Acceptance criteria:** No arbitrary client-supplied Python/SQL execution; errors identify invalid plans; results are based on actual data; saved plans remain available across browser refreshes while local storage persists.

### Journey C — Ask the AI analyst

1. User selects a dataset and asks a quantitative question in natural language.
2. Gemini generates a structured plan based on schema context.
3. The backend validates and executes the plan with Pandas, then obtains an evidence-grounded explanation.
4. User inspects the answer and available result evidence; conversation history is persisted.
5. For recognized “what is this dataset about?”-style questions, the server produces a local profile answer without Gemini.

**Acceptance criteria:** The system distinguishes planning from execution; the AI path only claims supported calculations; user can reopen and manage conversations; AI Chat **does not** expose the Dashboard/Analysis Excel export control.

### Journey D — Explore the dashboard

1. User selects dataset, primary/secondary metric, grouping, aggregation and filters.
2. Dashboard requests verified analysis and shows dataset KPIs, comparisons and tables.
3. User changes chart mode when the data supports the selected mode.
4. User exports a corresponding editable Excel chart when eligible.

**Acceptance criteria:** No hard-coded data series; responsive UI remains navigable; inappropriate chart modes are excluded; pie/donut proportions are not shown for truncated or unsuitable data.

## 5. Functional requirements — implemented

### FR-01 Dataset management

- **FR-01.1** Accept `.csv` file uploads via multipart form; valid UTF-8 text only.
- **FR-01.2** Reject empty, malformed, binary or out-of-bounds CSV content.
- **FR-01.3** Enforce 10 MiB file, 100,000 row and 100 column limits.
- **FR-01.4** Store uploaded CSV locally and record metadata in SQLite.
- **FR-01.5** Provide dataset list/detail, paginated preview, profile and delete endpoints.
- **FR-01.6** Report missing cells, duplicate rows, data types and unique-value counts.

### FR-02 Analysis engine

- **FR-02.1** Validate dataset UUID, column names, filters, metric aliases and aggregation compatibility.
- **FR-02.2** Support `sum`, `mean`, `min`, `max`, `count`, `nunique`.
- **FR-02.3** Support `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `contains` filters.
- **FR-02.4** Support up to three grouping columns, five metrics and 10 filters in the general analysis API.
- **FR-02.5** Return bounded rows (1–100), source/matched/result counts and truncation status.
- **FR-02.6** Reject plans referring to unknown columns or incompatible numeric/text operations.

### FR-03 AI analyst

- **FR-03.1** Accept dataset-bound questions (5–500 characters).
- **FR-03.2** Ask Gemini for structured, schema-constrained analytical plans for supported quantitative questions.
- **FR-03.3** Validate proposed plans and execute calculations with Pandas, not LLM-generated code.
- **FR-03.4** Generate explanations constrained to verified evidence where the API is available.
- **FR-03.5** Support recognized dataset-overview prompts through local profiling without a Gemini request.
- **FR-03.6** Persist conversation and message history; list, reopen, rename and delete conversations.
- **FR-03.7** Preserve computed evidence if the AI explanation service fails after successful execution.

### FR-04 Analysis persistence

- **FR-04.1** Save named, validated analysis plans in SQLite.
- **FR-04.2** List, fetch, rename, replace, rerun and delete saved plans.
- **FR-04.3** Keep a saved plan bound to its original dataset.
- **FR-04.4** Remove dependent saved analyses when the source dataset is deleted.

### FR-05 Visualizations and dashboard

- **FR-05.1** Display dynamic KPIs, filters, grouped metrics and verified result tables.
- **FR-05.2** Offer six chart modes: vertical bar, horizontal bar, line, area, pie, donut.
- **FR-05.3** Guard line/area behind ordered data and pie/donut behind complete additive nonnegative data.
- **FR-05.4** Provide colored categorical series for pie/donut and group excess categories into `Other` when appropriate.
- **FR-05.5** Lazy-load chart code and present hover details.
- **FR-05.6** Support dark/light mode, smooth navigation and reduced-motion behavior.

### FR-06 Export

- **FR-06.1** Export the returned analysis table as CSV with spreadsheet formula safeguards.
- **FR-06.2** Export a formatted PDF analysis report.
- **FR-06.3** Export an Excel `.xlsx` workbook containing an **editable native Excel chart** and the verified data sheet.
- **FR-06.4** Offer Excel chart download from Analysis and Dashboard only.
- **FR-06.5** Surface truncation metadata; prevent inappropriate chart exports server-side.

### FR-07 Safety and reliability

- **FR-07.1** Restrict local HTTP hosts and browser write origins.
- **FR-07.2** Limit request body sizes and rate-sensitive operations.
- **FR-07.3** Store the Gemini key only in the server environment, not frontend code.
- **FR-07.4** Avoid automatic formula evaluation of untrusted Excel cells.
- **FR-07.5** Keep input processing and caching bounded; invalidate cache on file deletion.

## 6. Non-functional requirements and current evidence

| Quality attribute | Requirement | Current status |
|---|---|---|
| Correctness | Computations are performed by Pandas; malformed plans fail validation | Implemented |
| Reliability | Data deletion handles filesystem/SQLite failure paths; API returns errors | Implemented, needs broader operations testing |
| Responsiveness | Lazy-load chart bundle; bounded cache for repeat CSV reads | Implemented; latency benchmarks pending |
| Maintainability | Modular backend/frontend and automated regression tests | Implemented |
| Accessibility | Keyboard navigation, labeling and reduced-motion support | Partially implemented; dedicated accessibility audit pending |
| Privacy | Work locally, limit upstream Gemini payloads, document persistence | Implemented within MVP scope |
| Security | Local-only guardrails; no unsupported public deployment claims | Implemented local guardrails; production hardening pending |
| Portability | PowerShell-friendly setup and reproducible dependency files | Implemented development setup |
| Observability | User-visible API errors and backend logging | Basic; structured monitoring not implemented |

## 7. UI/UX specification

The visual direction is **Nothing-inspired**: monochrome backgrounds, a technical typographic hierarchy, subtle accents, compact metadata labels and clear separation among Data, Analysis, AI Chat and Dashboard. Chart sectors are multicolored when visual distinction is necessary. The main design goal is legibility of real analytical evidence, not decorative visual density.

Key behaviors include conditional chart modes, loading/disabled export states, error messaging, interactive chart tooltips, smooth module transitions and respect for reduced-motion settings. Browser compatibility and small-screen usage should be re-audited during later polish work.

## 8. Technical constraints and dependencies

- Backend: Python 3.12, FastAPI, Pandas, SQLite/SQLAlchemy, `google-genai`, ReportLab, XlsxWriter and uv.
- Frontend: React, TypeScript, Vite, Recharts and Fetch API.
- Supported source files: CSV; the tool is limited to files that fit its configured byte/row/column caps.
- Optional external dependency for quantitative chat: an accessible Google Gemini model and configured key/quota.
- Local URLs: frontend `http://localhost:5173`; backend `http://127.0.0.1:8000`.
- Native Excel chart export requires a **single grouping column**, a matching metric and a supported chart/data combination.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [API.md](API.md) for exact code boundaries and contracts.

## 9. Verification and definition of done

**Recorded implementation verification (2026-10-17):**

- Backend: **75 passed** with one non-blocking Starlette/httpx deprecation warning.
- Frontend: **18 passed** (Vitest).
- Ruff lint: **passed**.
- TypeScript and Vite production build: **passed**.
- Manual browser checks: **6 passed**, including editable Excel workbook checks.
- Git feature changes: three focused commits pushed to `main` and a clean working tree reported.

A feature is done for this MVP when it is integrated in the expected module, produces verified results, handles invalid inputs, passes relevant automated tests and has manual verification for interactions not covered by tests. These checks do **not** equate to a production certification.

## 10. Open product questions / future scope

**Proposed, not yet implemented:**

1. Should the project remain permanently local-first or evolve into a hosted service?
2. What screen sizes and assistive-technology combinations must receive first-class support?
3. What performance target is acceptable for near-limit CSV datasets?
4. Should additional formats such as `.xlsx` import or Parquet be supported?
5. What data-retention and backup controls should exist for locally stored messages and CSV files?
6. What authentication and authorization model would be required before deployment?

## 11. Out of scope for current release

- Cloud-hosted SaaS, SSO/login, user accounts and collaborative workspaces.
- Scheduled tasks, live data connectors and autonomous web actions.
- Complex free-form visual SQL/Python execution.
- ML model training and forecasting as a supported product flow.
- Unlimited or distributed data ingestion and real-time streaming analytics.
- Any guarantee that AI supports arbitrary natural-language questions.

## 12. Documentation index

[Root README](../README.md) · [API](API.md) · [Architecture](ARCHITECTURE.md) · [Database](DATABASE.md) · [Roadmap](ROADMAP.md) · [Security](SECURITY.md)
