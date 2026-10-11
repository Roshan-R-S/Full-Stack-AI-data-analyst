# FULL STACK AI DATA ANALYST

**Turn CSV data into verified insights using AI, Python, and interactive visualizations.**

A full-stack AI-powered data analytics application built with **React, TypeScript, FastAPI, Pandas, SQLite, and Google Gemini**.

Upload a dataset, explore its structure, perform calculations, ask natural-language questions, and visualize the results through an interactive dashboard.

The interface follows a **Nothing-inspired design language** with minimal layouts, monochrome surfaces, typography-led navigation, and subtle accents.

---

## Features

### 01 / Dataset Management

- Upload CSV datasets through a drag-and-drop interface.
- View uploaded datasets and metadata.
- Preview records and inspect column information.
- Explore missing values, unique values, data types, and duplicate rows.
- Delete datasets when they are no longer needed.
- Basic dataset size and structure validation.

### 02 / Pandas Analytics Engine

- Execute deterministic, server-side calculations.
- Supported aggregations: `sum`, `mean`, `min`, `max`, `count`, `nunique`.
- Filter data using comparison, membership, and text operators.
- Group records by selected columns.
- Sort, limit, and inspect analytical results.
- Validate analysis requests before execution.

### 03 / Gemini AI Analyst

Ask questions about uploaded datasets in natural language.

Examples:

- Which credit card type has the highest average annual income?
- What is the average credit score by card type?
- Which region generates the most revenue?
- What is the total sales amount for each product?

**How it works:**

1. Gemini receives the question and relevant dataset schema.
2. Gemini generates a structured analytical plan.
3. The backend validates the plan.
4. Pandas executes the calculation.
5. Gemini explains the verified result.
6. The interface presents the explanation, evidence table, and applicable visualization.

**Important:** Gemini assists with planning and explanation. Pandas performs the numerical calculations.

AI Chat also includes Enter-to-send, Ctrl+Enter or Shift+Enter for new lines, and automatic conversation scrolling.

### 04 / Interactive Visualizations

- Bar charts for grouped metric comparisons.
- Donut charts for suitable additive proportions.
- Line charts for supported ordered data.
- Hover tooltips and chart-type controls.
- Visualizations backed by actual Pandas results.
- Lazy-loaded Recharts components for improved initial loading.

### 05 / Data Intelligence Dashboard

A configurable analytics workspace featuring:

- Source records, columns, missing cells, and duplicate-row KPIs.
- Matched-record counts after filtering.
- Dataset and grouping selection.
- Primary and secondary metrics.
- Aggregation controls.
- Conditional filters.
- Multiple synchronized analytical visualizations.
- Verified results tables.

The dashboard adapts to the selected dataset rather than relying on hardcoded example values.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Visualizations | Recharts |
| Styling | CSS, Nothing-inspired design |
| Backend | Python, FastAPI |
| Data Processing | Pandas |
| AI Integration | Google Gemini API |
| Database | SQLite |
| Validation | Pydantic |
| HTTP Client | Fetch API |
| Python Environment | uv |
| Testing | pytest |

---

## Project Structure

**Backend**

- `backend/app/api/v1/` — REST API endpoints
- `backend/app/analytics/` — Pandas execution and plan validation
- `backend/app/ai/` — Gemini client, planning, and explanations
- `backend/app/schemas/` — Request and response validation
- `backend/tests/` — Automated backend tests

**Frontend**

- `frontend/src/pages/` — Datasets, Analysis, AI Chat, and Dashboard pages
- `frontend/src/components/` — Reusable UI components
- `frontend/src/components/chat/` — Chat interface
- `frontend/src/components/charts/` — Interactive charts
- `frontend/src/services/` — Backend API communication
- `frontend/src/types/` — Shared TypeScript types
- `frontend/src/index.css` — Application styling

---

## Getting Started

### Prerequisites

Install the following:

- Python 3.12 or a compatible version supported by the project
- Node.js and npm
- uv (Python package manager)
- Git
- A Google Gemini API key

### 1. Clone the Repository

`git clone https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst.git`

`cd Full-Stack-AI-data-analyst`

### 2. Install Backend Dependencies

From the project root:

`uv sync --project ./backend`

### 3. Configure Environment Variables

Create a file named `backend/.env` and configure:

- `GEMINI_API_KEY` — Your Gemini API key
- `GEMINI_MODEL` — The supported Gemini model configured for the project

Never commit actual credentials or `.env` files.

### 4. Start the Backend

From the project root:

`uv run --project ./backend uvicorn app.main:app --app-dir backend --reload --port 8000`

Backend URL: `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

### 5. Install and Start the Frontend

Open a second terminal from the project root:

`npm install --prefix ./frontend`

`npm run dev --prefix ./frontend`

Frontend URL: `http://localhost:5173`

### 6. Run Tests

Backend:

`uv run --project ./backend pytest -q`

Frontend production build:

`npm run build --prefix ./frontend`

The backend currently has **18 passing tests**, as verified during development.

---

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Backend health check |
| GET | `/api/v1/datasets` | List datasets |
| POST | `/api/v1/datasets` | Upload CSV |
| GET | `/api/v1/datasets/{id}` | Dataset details |
| GET | `/api/v1/datasets/{id}/preview` | Preview records |
| GET | `/api/v1/datasets/{id}/profile` | Dataset profile |
| DELETE | `/api/v1/datasets/{id}` | Delete dataset |
| POST | `/api/v1/analysis` | Execute Pandas analysis |
| POST | `/api/v1/chat/ask` | Ask the AI analyst |

Interactive API documentation is available through FastAPI's `/docs` endpoint when the backend is running.

---

## Architecture

**Dataset workflow**

CSV Upload → FastAPI Validation → Local Dataset Storage → Pandas Profiling → SQLite Metadata → React Interface

**AI analytical workflow**

User Question → Gemini Structured Plan → Plan Validation → Pandas Execution → Gemini Explanation → Verified Results + Recharts

**Dashboard workflow**

Dataset Selection → Metrics and Filters → Analytics API → Pandas Aggregation → KPIs + Charts + Results Table

The complete CSV does not need to be sent to Gemini for the implemented analytical workflow. Dataset schemas, questions, and computed evidence are used for AI planning and explanations.

---

## Current Limitations

This project is currently a **functional local-development MVP**, not a production-hardened hosted service.

- CSV is the primary supported file format.
- Data processing runs on the backend using Pandas.
- AI functionality requires valid Gemini API configuration and available API quota.
- AI questions support the analytical operations implemented by the planner.
- Conversations are not yet persistently stored across browser refreshes.
- Authentication, user isolation, and production security controls are not implemented.
- Avoid hosting the current backend publicly without additional safeguards.

---

## Roadmap

- [x] Project foundation and frontend/backend integration
- [x] CSV upload and dataset profiling
- [x] Pandas analytics engine
- [x] Gemini-powered natural-language analysis
- [x] Verified AI answers and evidence tables
- [x] Interactive data visualizations
- [x] Configurable analytics dashboard
- [x] Lazy-loaded chart components
- [ ] Persistent AI conversation history
- [ ] Saved analytical configurations
- [ ] CSV and PDF report exports
- [ ] Expanded automated testing
- [ ] Performance optimization and security hardening
- [ ] Production deployment

---

## Privacy and Security

- Keep Gemini API keys in local environment variables.
- Do not commit `.env` files or private datasets.
- Uploaded data is processed by the local FastAPI backend.
- AI integration uses selected metadata and analytical evidence rather than uploading the entire CSV as part of each question.
- Add authentication and stronger deployment protections before processing sensitive information on a public server.

---

## Author

**Roshan RS**

GitHub: [Roshan-R-S](https://github.com/Roshan-R-S)

Repository: [Full-Stack-AI-data-analyst](https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst)

---

**Built to make data analysis more accessible, interactive, and understandable.**