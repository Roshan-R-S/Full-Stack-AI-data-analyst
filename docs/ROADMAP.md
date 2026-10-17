# Product Roadmap

> **Project:** Full Stack AI Data Analyst
> **Snapshot:** 2026-10-17
> **Status:** Implemented local-development MVP with tested feature upgrades pushed to `main`.
> **Planning note:** Future work below is a proposal, not a claim that it is shipped or committed to a calendar date.

## 1. Direction

The project has moved past its first functional MVP. The next stage is to make the **existing application more polished, observable, maintainable and safe for its intended local use**, while preserving its central promise: Gemini helps interpret a question; Pandas calculates the actual answer.

We should not begin a separate rewrite or add complex cloud infrastructure just to document or package the project.

## 2. Current milestone snapshot

| Milestone | Status | What exists |
|---|---|---|
| Foundation | Complete | FastAPI, React/TypeScript, Vite, SQLite, local development setup |
| CSV dataset workspace | Complete | Upload, list, preview, profile, delete, validation |
| Pandas analysis | Complete | Typed plans, filters, aggregation, grouping, ordering, limits |
| Gemini AI analyst | Complete within supported scope | Structured planning, verified execution, evidence-grounded explanations |
| Dashboard and charts | Complete within supported scope | KPIs, filtered/grouped analytics, six chart modes |
| Persistent conversations | Complete | SQLite-backed message history, list/view/rename/delete |
| Saved analyses | Complete | Save, load, update, rerun, rename and delete plans |
| CSV and PDF exports | Complete | Verified result downloads |
| Excel chart exports | Complete | Native editable Excel charts from Dashboard and Analysis |
| Dataset-overview prompts | Complete | Recognized descriptive questions answered locally |
| CSV caching | Complete | Bounded 2-entry / 64 MiB in-process cache with copy isolation |
| Smooth navigation | Complete | View transitions and reduced-motion-aware scrolling |
| Automated baseline | Complete | 75 backend tests, 18 frontend tests, Ruff and Vite build passing in latest verified run |
| Documentation refresh | In progress | Root README refresh and the six `docs/` references |
| Production deployment | Not started | Current security model is explicitly local-only |

## 3. Recent shipped work

The following three feature commits were pushed to `main` in the reported verification session:

| Commit | Area | Summary |
|---|---|---|
| [`d5f8690`](https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst/commit/d5f8690) | Performance | Bounded CSV caching and unit tests |
| [`d5dd4a9`](https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst/commit/d5dd4a9) | AI chat | Dataset-overview questions and regression tests |
| [`5f59d44`](https://github.com/Roshan-R-S/Full-Stack-AI-data-analyst/commit/5f59d44) | Visualization/export | More chart modes, editable Excel chart export, smooth navigation, tests |

**Verification snapshot:** backend `75 passed, 1 warning`; frontend `18 passed`; Ruff clean; frontend production build succeeded; six browser checks passed. The warning concerns a Starlette/httpx TestClient deprecation, not a failing product test.

## 4. Phase 8A — Documentation and project presentation

**Status:** In progress.

### Deliverables

- [x] Identify outdated README statements (test counts, persistence and exports).
- [x] Prepare updated root README content.
- [x] Draft accurate documentation for APIs, architecture, database, PRD, roadmap and security.
- [ ] Add finished Markdown files to the repository's existing `docs/` directory.
- [ ] Make the root README link to all six documents.
- [ ] Capture actual screenshots of Datasets, Analysis, AI Chat and Dashboard and add them to versioned assets.
- [ ] Recheck Markdown links/diagrams on GitHub rendering.
- [ ] Commit and push documentation-only changes.

**Definition of done:** All documentation links resolve; statements match the code; no placeholder credentials or mock UI images are presented as real screenshots.

## 5. Phase 8B — Frontend polish, usability and accessibility

**Status:** Proposed.

### Priority tasks

- [ ] Review layouts and overflow on narrow screens, tablets and desktop.
- [ ] Audit keyboard focus order, button labels, form errors and table accessibility.
- [ ] Add or improve `aria-live` announcements for async states and export failures.
- [ ] Ensure chart insights remain understandable through accessible data tables.
- [ ] Check color contrast in dark and light mode, especially muted metadata and multicolored charts.
- [ ] Examine perceived loading speed, skeletons or lightweight progress messaging for large CSVs.
- [ ] Check navigation transitions with reduced-motion enabled.
- [ ] Improve empty, error and long-running states without hiding verified results.

**Definition of done:** A short reproducible interaction checklist works on common viewport sizes and keyboard-only navigation; no visual regressions in existing workflows.

## 6. Phase 8C — Expand regression coverage and CI quality gates

**Status:** Proposed.

- [ ] Add React component tests for chart-mode eligibility and chart-mode selection.
- [ ] Test Excel-export handler wiring: present in Analysis/Dashboard, absent in AI Chat.
- [ ] Add browser-level end-to-end smoke tests for CSV upload → Analysis → export.
- [ ] Exercise dataset deletion when SQLite and filesystem operations fail independently.
- [ ] Extend Excel tests to cover all supported chart types and partial-result metadata.
- [ ] Verify CSV/Excel formula defenses across more malicious-looking input strings.
- [ ] Ensure CI runs backend Ruff + pytest and frontend Vitest + TypeScript/build consistently.
- [ ] Review and address the Starlette TestClient dependency deprecation when a compatible supported upgrade exists.

**Definition of done:** CI fails on genuine regressions and all new tests can run in a clean clone using documented commands.

## 7. Phase 8D — Performance and reliability

**Status:** Proposed. CSV caching has already shipped; this phase verifies and extends it as needed.

- [ ] Benchmark upload, preview, profile, analysis and export at representative file sizes.
- [ ] Measure repeat-read cache effectiveness and memory use under realistic workloads.
- [ ] Profile charts with high-cardinality groupings and confirm behavior when results are truncated.
- [ ] Audit PDF and Excel generation cost for maximum permitted result sizes.
- [ ] Add cancellation/timeout handling or clear progress states where synchronous work is noticeable.
- [ ] Review local database backups and recovery after unclean shutdown.
- [ ] Document any measured bottlenecks before introducing additional dependencies.

**Definition of done:** Performance recommendations cite measured timings/memory; no claim of a speedup without evidence.

## 8. Phase 8E — Security and release readiness

**Status:** Proposed.

- [ ] Review local-only Host/Origin/CORS assumptions and HTTP request limits.
- [ ] Validate Gemini configuration and ensure failures remain understandable.
- [ ] Check `.gitignore`, backup paths, build assets and release files for secrets/private datasets.
- [ ] Document security limitations and responsible handling of sensitive CSVs.
- [ ] Align version numbers (FastAPI app, health endpoint, backend package and frontend package) before tagging a release.
- [ ] Prepare a changelog, release notes and a reproducible clean-clone setup guide.
- [ ] Tag a release only after documentation and regression checks pass.

**Definition of done:** A first-time contributor can clone, configure, run and test the app; release notes accurately state supported features and limitations.

## 9. Optional future directions (not committed)

### Richer analytics

- [ ] Additional file imports such as XLSX/Parquet with independent validation.
- [ ] More advanced but still deterministic analysis operators.
- [ ] Better date parsing/semantic axes and configurable chart labels.
- [ ] Export history and reproducible run provenance.

### More sophisticated AI

- [ ] Clearer unsupported-question guidance and better planner diagnostics.
- [ ] Retrieval-based knowledge sources if a real use case for schema/data dictionary context emerges.
- [ ] Evaluation suite measuring planner correctness against known datasets and questions.
- [ ] Model-fallback behavior only after careful cost and data-sharing analysis.

### Multi-user or hosted deployment (requires separate design)

- [ ] Authentication, accounts, session handling, authorization and dataset ownership checks.
- [ ] Secure object storage, per-user data isolation, quotas, audit logs, monitoring and backups.
- [ ] Production deployment architecture, TLS, secret management, scheduled data retention and incident procedures.
- [ ] Schema migrations, stronger relational integrity and concurrency testing.

**Warning:** The current API's local security checks do **not** substitute for any of these hosting requirements. A direct public deployment is not a supported phase of the present codebase.

## 10. Release checklist

Use this before publishing a new GitHub release:

- [ ] `git status --short` is clean before release work.
- [ ] Backend: `uv run --project .\backend ruff check .\backend\app .\backend\tests`.
- [ ] Backend: `uv run --project .\backend pytest -q`.
- [ ] Frontend: `npm.cmd --prefix .\frontend run test`.
- [ ] Frontend: `npm.cmd --prefix .\frontend run build`.
- [ ] Manual validation of dataset upload, analysis, AI Chat, saved plans and exported files.
- [ ] Documentation links, screenshots, `.env.example`, local-only disclaimers and prerequisites checked.
- [ ] No committed credentials, real uploaded datasets or local database copies.
- [ ] Commit changelog/release notes and confirm target commit on `main`.
- [ ] Publish a versioned tag/release only after all items pass.

## 11. Current next action

**Finish Phase 8A**: download/place the six Markdown files in `docs/`, link them from the root README, check `git diff --check`, then commit and push documentation separately. Afterwards begin the Phase 8B UI/accessibility pass.

## 12. References

[README](../README.md) · [PRD](PRD.md) · [Architecture](ARCHITECTURE.md) · [API](API.md) · [Database](DATABASE.md) · [Security](SECURITY.md)
