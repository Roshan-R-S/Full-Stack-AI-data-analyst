# Security Model and Guidance

> **Scope:** Security characteristics of the current **local-first, single-user development MVP**, reviewed against repository `main` on 2026-10-17.
> **Important:** This document is not a claim of independent security certification or production readiness.

## 1. Deployment boundary — local use only

The present Full Stack AI Data Analyst is designed to run on the developer's own machine. The backend assumes that the local computer and its processes are trusted. **No accounts, login, session authentication, per-dataset ownership permissions or tenant isolation are implemented.**

**Do not expose the existing FastAPI service to a public network or Internet endpoint as-is.** Host/origin checks, content-size limits and basic throttling reduce local-development risk but do not replace production authentication and authorization.

Recommended local backend command:

```powershell
Set-Location D:\full-stack-ai-data-analyst
uv run --project .\backend uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

Avoid `--host 0.0.0.0` for this MVP. Use the frontend at `http://localhost:5173` and the backend at `http://127.0.0.1:8000` (or `localhost:8000`). The development Vite proxy forwards `/api` calls to the backend.

## 2. Threat assumptions and trust boundaries

| Boundary | Current posture | Residual risk |
|---|---|---|
| Local browser → FastAPI | Restrictive HTTP Host / write-Origin checks | An untrusted local process may make requests without a browser Origin header |
| Client input → Pandas | Typed analysis plans and column/operation validation | Heavy computation, semantic misuse and problematic source data still require bounded use |
| CSV file → application | File extension/content checks and size/shape limits | Malformed or sensitive content requires care; CSV is untrusted input |
| User question / dataset schema → Gemini | Schema-constrained planner; plan validation before execution | API-bound data exposure, model errors, prompt injection attempts |
| Local disk → SQLite/uploads | Files stored under local `data/` directories | Other local processes/users with OS access may read them; no encryption-at-rest guarantee |
| Verified results → spreadsheet | CSV injection mitigation and literal Excel string writes | Spreadsheet viewers may have differing import behavior; recheck external consumers |
| Any public deployment | **Not supported** | Missing identity, isolation, transport and operational security features |

## 3. HTTP Host, Origin and browser restrictions

Source: `backend/app/core/local_security.py`.

### Trusted Host

The middleware expects one HTTP `Host` header that matches `localhost` or `127.0.0.1`, optionally including a port. It rejects unexpected hostnames. A special synthetic `testserver` path is permitted only for the FastAPI TestClient's `testclient` address.

### Write request origins

For `POST`, `PUT`, `PATCH` and `DELETE` requests:

- `Sec-Fetch-Site: cross-site` is blocked.
- An explicit `Origin` must be in the allowed local set:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `http://localhost:8000`
  - `http://127.0.0.1:8000`
- Requests without an `Origin` are permitted so local CLI tools continue to function.

**These are browser-oriented local safeguards, not authentication.** A local script can omit `Origin`; this is an intentional trust assumption of the current design.

### Response hardening

The middleware adds:

```text
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-store    (for /api/ paths)
```

This is not a substitute for a complete Content Security Policy or production TLS setup; neither is established by this list.

## 4. Request caps and rate limiting

Source: `backend/app/core/request_limits.py` and `backend/app/core/config.py`.

### Request sizes

| Request | Implemented cap |
|---|---|
| Standard API JSON HTTP body | 64 KiB |
| Dataset-upload HTTP body (multipart envelope) | 12 MiB |
| Actual uploaded CSV file | 10 MiB (`10 * 1024 * 1024` bytes) |
| Parsed dataset size | Up to 100,000 rows and 100 columns |

The middleware checks the declared `Content-Length` and the actual accumulated request bytes, covering chunked requests as well as normal requests. The upload handler also enforces the more specific CSV file-size cap.

### Operation rate limits

The in-process sliding-window limiter bounds specific POST endpoints per 60-second window:

| Operation | Requests / 60 seconds |
|---|---:|
| AI chat `/chat/ask` | 12 |
| Deterministic `/analysis` | 60 |
| Export `/exports/analysis/*` | 30 |
| Saved-analysis `/saved-analyses/{id}/run` | 30 |
| CSV upload `/datasets` | 12 |

A rejected request returns `429` with `Retry-After`. These counters are **shared process-level buckets**, not per-IP/per-user quotas; they reset on server restart and do not synchronize across separate server worker processes.

## 5. CSV validation and parser safety

Source: `backend/app/analytics/csv_loader.py` and `backend/app/api/v1/datasets.py`.

- Requires a `.csv` filename extension; strips parent path components from the provided filename.
- Rejects empty files, null-byte/binary-like inputs, invalid UTF-8, parse errors and empty datasets.
- Uses Pandas CSV parsing with `on_bad_lines="error"` and a configured row cap.
- Bounds file bytes and column count; uploads are stored by **generated UUID**, not by client-supplied disk path.
- Uses a bounded in-memory DataFrame cache with file fingerprint checks. Callers receive defensive copies so one analysis should not mutate shared cached data.

Only CSV is currently supported as an upload format. Arbitrary uploaded file paths are not accepted as a client parameter.

## 6. Analysis input validation

Source: `backend/app/schemas/analysis.py` and `backend/app/analytics/plan_validator.py`.

- Pydantic forbids extra fields in analysis plans and constrains filter operators, aggregations and the result limit.
- The validator rejects unknown grouping, metric, filter and sort columns.
- Numeric aggregations and comparisons require numeric columns; `contains` requires text; filter values must match the expected operator form.
- Aliases must be unique and cannot conflict with grouping columns.
- The engine applies known Pandas functions, not arbitrary Python expressions or SQL text received from the browser.

A valid request can still be computationally expensive near configured dataset size limits. Treat all uploaded data as untrusted and keep testing resource consumption.

## 7. Gemini integration and privacy

Source: `backend/app/ai/client.py`, `backend/app/ai/planner.py`, `backend/app/ai/explainer.py`.

### Secret handling

Create `backend/.env` from `backend/.env.example` and set:

```dotenv
GEMINI_API_KEY=YOUR_OWN_API_KEY
GEMINI_MODEL=YOUR_SUPPORTED_MODEL_NAME
```

Do not commit a real `.env` file or embed API keys in frontend variables, screenshots, test fixtures or Markdown documentation. The Gemini client runs in the **backend**. The configured model must be available to the API key and quota.

### What the external AI provider receives

For the implemented quantitative AI path, the planner receives the **user question** and **dataset schema context** (row count, column names and dtypes); the explainer receives the question and a **subset of verified analytical evidence** (counts, columns and up to 10 returned result rows). The implementation does not send the *entire CSV file* as its standard planning or explanation payload.

**Important:** Schema names, questions and computed evidence can still contain sensitive or proprietary information. Local processing is **not equivalent to an offline or zero-data-sharing mode** when Gemini is used. Review the provider's data practices and your own dataset's sharing permissions before using the AI feature.

Recognized descriptive dataset-overview questions use local Pandas profiling with `model: local-profile` and **do not require Gemini**.

### Prompt injection / hallucination boundaries

- Planner instructions treat dataset schema as untrusted data and require exact existing columns and fixed allowed operations.
- Gemini cannot cause the backend to execute arbitrary code through the structured plan interface.
- The returned plan is revalidated by the server before computation.
- The explanatory step is supplied verified evidence and instructed not to invent numbers.

These measures reduce risk; they do **not** guarantee that an AI explanation will be complete, correct in every nuance or safe against every prompt injection attempt. Review the verified result table for consequential decisions.

## 8. CSV and Excel formula-injection defenses

### CSV exports

Source: `backend/app/api/v1/exports.py`.

When an exported cell is a string whose meaningful beginning suggests a spreadsheet formula (`=`, `+`, `-`, `@`, including certain leading whitespace cases), the CSV exporter prefixes an apostrophe. This helps reduce CSV formula-injection risk when opened in spreadsheet software.

### Excel exports

Source: `backend/app/services/chart_excel.py`.

- XlsxWriter is initialized with `strings_to_formulas=False` and `strings_to_urls=False`.
- Text cells use explicit `write_string`, and numeric cells use `write_number`.
- Export validation restricts chart types to supported choices and verifies grouping/metric compatibility.
- Excel export integration tests cover native chart packaging, unsuitable pie/metric requests and preservation of a formula-looking string as literal text.

This does not guarantee identical behavior in every third-party CSV importer or spreadsheet tool; validate expected tools when sharing sensitive exports.

## 9. Local data lifecycle and confidentiality

| Artifact | Storage | Sensitivity consideration |
|---|---|---|
| Uploaded CSV | `data/uploads/<uuid>.csv` | Contains raw imported records |
| Dataset metadata | `data/app.db`, `datasets` | Names, sizes and upload time |
| AI conversation/message history | `data/app.db`, conversation tables | User questions, answer text and computed evidence |
| Saved analyses | `data/app.db`, `saved_analyses` | Analytical plans, column/filter values |
| CSV cache | Backend process memory | Temporary decoded copies of uploaded dataset |
| Exports | Browser/downloads folder | Copies of computed results, possibly sensitive |

On dataset deletion, the backend stages the CSV file out of its active path, deletes associated SQLite conversation and saved-analysis records and the dataset metadata, and attempts to remove the staged file. It includes rollback and recovery handling for database failures; cleanup warnings require manual investigation if filesystem cleanup fails.

### Recommended local hygiene

1. Keep `backend/.env`, `data/app.db`, `data/uploads/` and sensitive exports out of Git commits.
2. Check `git status --short` and `git diff --cached --name-only` before each push.
3. Never put real API keys or private customer data in repository issues, screenshots or sample documentation.
4. Restrict Windows folder access to the appropriate OS user; lock your computer and use disk encryption where sensitive data is involved.
5. Treat backups, debug logs and downloaded spreadsheets as additional copies requiring protection.
6. Only delete files that are no longer needed and retain a separate backup when recovery is required.

## 10. Risks before any public deployment

A separate deployment/security design is required. At minimum, plan and implement:

- **Authentication and authorization** on every dataset, conversation, analysis and export endpoint.
- Per-user storage ownership, secure object storage and tenant isolation.
- TLS, secure cookie/session handling if applicable, and a properly configured proxy/host policy.
- Per-client quotas/rate limits, bounded execution resources and abuse monitoring.
- Secret management, key rotation, audit logging and secure error reporting.
- Backups/restores, migrations, retention/deletion policies and incident procedures.
- CORS/CSRF review appropriate to the hosting architecture, rather than relying on a fixed local-origin allowlist.
- Dependency auditing and automated security review in CI.

Do not simply remove the localhost restriction to make this application reachable on the Internet.

## 11. Responsible reporting

If you discover a potential security issue, **avoid posting exploit details, live keys or private dataset contents in a public issue**. Contact the repository maintainer through a private available channel (such as GitHub private vulnerability reporting, if enabled) and provide a minimal non-sensitive reproduction.

No dedicated email address or vulnerability-reporting policy is asserted here because none is verified from the repository.

## 12. Maintainer checklist

- [ ] Backend listening only on loopback for local development.
- [ ] No real credentials tracked by Git.
- [ ] Real customer data excluded from demo/sample datasets and screenshots.
- [ ] Upload constraints and unexpected file types tested.
- [ ] Formula-injection regression tests remain passing.
- [ ] Rate limits and allowed Origins reviewed after endpoint changes.
- [ ] Sensitive error details withheld from public-facing responses.
- [ ] CI and dependencies updated deliberately and tested.
- [ ] Public deployment remains disabled until authentication and isolation are implemented.

## 13. References

[Architecture](ARCHITECTURE.md) · [API reference](API.md) · [Database](DATABASE.md) · [PRD](PRD.md) · [Roadmap](ROADMAP.md) · [Root README](../README.md)
