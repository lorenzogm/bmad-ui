---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-04-23'
workflowType: testarch-nfr-assess
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
  - _bmad-ui/biome.json
  - _bmad-ui/tsconfig.json
  - _bmad-ui/playwright.config.ts
  - _bmad-ui/package.json
  - _bmad-ui/tests/smoke.spec.ts
  - _bmad-ui/tests/artifact-consistency.spec.ts
  - _bmad-ui/tests/outcome-sessions.spec.ts
  - _bmad-ui/tests/session-traces.spec.ts
  - _bmad-ui/tests/workflow-actions.spec.ts
  - _bmad-ui/tests/helpers/mock-api.ts
  - .github/workflows/ci.yml
  - .github/workflows/codeql.yml
---

# NFR Assessment — bmad-ui

**Date:** 2026-04-23
**Story:** N/A (full platform assessment)
**Overall Status:** CONCERNS ⚠️

---

> Note: This assessment summarises existing evidence; it does not run tests or CI workflows.
> Execution mode: SEQUENTIAL (4 NFR domains). All evidence gathered from static analysis of source, configuration, and artifact files.

---

## Executive Summary

**Assessment:** 1 PASS, 5 CONCERNS, 1 FAIL, 1 CONCERNS (across 8 ADR categories)

**Blockers:** 1 — Production error monitoring absent (Monitorability FAIL)

**High Priority Issues:** 3
- JavaScript bundle 3× over recommended size (no code splitting)
- `marked` markdown renders unsanitised HTML via `dangerouslySetInnerHTML` in 4 routes
- E2E tests excluded from main `pnpm check` CI gate

**Recommendation:** Do not treat as a release blocker for the current single-user local-dev use case, but address the three high-priority issues before any public multi-user deployment. The platform is well-structured for its phase; gaps are proportionate to a Phase 1 local tool.

---

## Performance Assessment

### Response Time (p95)

- **Status:** CONCERNS ⚠️
- **Threshold (NFR3):** Core UI pages render initial usable state in <3 seconds
- **Actual:** No benchmark measurement exists; 1,610 kB minified JS bundle (3× the Vite-recommended 500 kB threshold) creates a material TTI risk on slow connections
- **Evidence:** `vite build` output — `dist/assets/index-Bsrvqk1l.js 1,610.13 kB │ gzip: 506.45 kB`; Vite warning: *"Some chunks are larger than 500 kB after minification"*
- **Findings:** No load-time benchmarks exist. Gzip reduces to ~506 kB, which is acceptable on fast connections but borderline on 3G. No Lighthouse or Web Vitals measurements in CI.

### Throughput

- **Status:** N/A — single-user local developer tool; no concurrent-user throughput target defined

### Resource Usage

- **CPU Usage**
  - **Status:** PASS ✅
  - **Threshold:** No excessive blocking operations
  - **Actual:** Static SPA with TanStack Query; no heavy client-side computation except ECharts rendering
  - **Evidence:** `biome check src/` passes clean; Biome enforces no barrel files reducing import tree size

- **Memory Usage**
  - **Status:** CONCERNS ⚠️
  - **Threshold (NFR25):** Analytics aggregation for 500+ sessions without noticeable UI lag
  - **Actual:** All session JSON files are compiled into the production bundle at build time via `vite-plugin-static-data`; `overview.json` is 512 kB, `analytics.json` 284 kB; 100+ individual session files included in `dist/`. No pagination, windowing, or virtualisation in session lists.
  - **Evidence:** `vite build` output lists 100+ session JSON files compiled into dist; `[PLUGIN_TIMINGS] Warning: bmad-static-data` significant build time flag

### Scalability (Build / Data Growth)

- **Status:** CONCERNS ⚠️
- **Threshold:** Build must remain fast and bundle must not grow unboundedly as sessions accumulate
- **Actual:** Build time 9.93 s with ~100 sessions; no cap on session data compiled into bundle; linear growth expected
- **Evidence:** `vite build` output; static data plugin warning; session files enumerable in `dist/data/session/`
- **Findings:** Each new BMAD session adds a JSON file to the bundle. At 1,000 sessions the bundle will roughly double. No lazy loading, pagination, or dynamic import for session data is implemented.

---

## Security Assessment

### Authentication & Authorization

- **Status:** N/A
- **Findings:** bmad-ui is a local-only personal developer tool. There is no user authentication system, which is architecturally correct. Action features (run skill, abort, send input) are gated behind `IS_LOCAL_MODE` — network-isolated by design.

### Secrets Management

- **Status:** PASS ✅
- **Threshold (NFR5, NFR6):** Secrets never committed plaintext; managed via dotenvx with environment separation
- **Actual:** dotenvx workflow configured; `permissions: contents: read` on CI; Terraform manages credentials with least-privilege scoping
- **Evidence:** `.github/workflows/ci.yml` → `permissions: contents: read`; architecture.md confirms dotenvx; project-context.md documents auto-mask requirement (added 2026-04-23)

### Branch Protection & Audit Trail

- **Status:** PASS ✅
- **Threshold (NFR7, NFR9):** Branch protection enforces required checks; infrastructure operations auditable
- **Actual:** Terraform manages branch protection; CI workflow runs on all PRs to main; workflow history provides audit trail
- **Evidence:** `.github/workflows/ci.yml` triggers on `pull_request` to `main`; `infra/github/` Terraform

### Input Validation / XSS

- **Status:** CONCERNS ⚠️
- **Threshold:** No unsanitised HTML injected into the DOM from untrusted sources
- **Actual:** Four routes use `dangerouslySetInnerHTML` with `marked`-rendered content without a sanitisation step (DOMPurify or equivalent). While current data sources are local BMAD artifact files (not user-supplied input), any future ingestion of externally authored content would create an XSS vector.
  - `src/routes/workflow.$phaseId.$stepId.tsx:78`
  - `src/routes/analytics-quality.tsx:319`
  - `src/routes/prepare-story.$storyId.tsx:278`
  - `src/routes/docs.$docId.tsx:66`
- **Evidence:** `grep dangerouslySetInnerHTML src/` — 4 occurrences; `marked` v18.0.0 used without sanitise option
- **Recommendation:** Pipe `marked` output through `DOMPurify.sanitize()` before injecting into DOM. Low-urgency for a local tool, but important if content ever comes from external sources.

### Dependency Vulnerability Scanning

- **Status:** CONCERNS ⚠️
- **Threshold:** No critical or high known vulnerabilities
- **Actual:** `pnpm audit` — 0 known vulnerabilities ✅. However, no automated Dependabot or Renovate configuration exists in `.github/`; dependency updates are manual.
- **Evidence:** `pnpm audit` output; no `.github/dependabot.yml` found
- **Recommendation:** Add Dependabot (`dependabot.yml`) for automated weekly dependency update PRs.

### Static Code Analysis (CodeQL)

- **Status:** PASS ✅
- **Threshold:** Automated security scanning on all pushes to main
- **Actual:** CodeQL Advanced configured for JavaScript/TypeScript and GitHub Actions; runs on push, PR, and weekly schedule
- **Evidence:** `.github/workflows/codeql.yml` — active, covers `javascript-typescript` and `actions` languages

---

## Reliability Assessment

### CI Quality Gate

- **Status:** PASS ✅
- **Threshold (NFR13):** Required quality checks (lint, types, tests, build) must pass before merge to main
- **Actual:** `pnpm check` runs lint (Biome) → TypeScript type-check → Vitest → Vite build in CI; all passing cleanly
- **Evidence:** `pnpm check` exits 0; `biome check src/` — "Checked 40 files, No fixes applied"; `tsc --noEmit` passes

### E2E Test Coverage

- **Status:** CONCERNS ⚠️
- **Threshold (NFR27):** All existing UI routes must have at least one E2E smoke test covering render-without-error verification
- **Actual:** 5 Playwright spec files cover: smoke (home + navigation + workflow detail routes), artifact consistency, outcome sessions, session traces, workflow actions. Several routes have dedicated tests. However, `check:e2e` (Playwright) is **not part of the main `pnpm check` gate** — it is a separate command. E2E regressions will not block CI merges.
- **Evidence:** `package.json` scripts: `"check": "pnpm run check:lint && pnpm run check:types && pnpm run check:tests && pnpm run build"` — E2E absent; `check:e2e` is separate
- **Recommendation (HIGH):** Add `playwright test` to the CI `validate` job or add a dedicated `e2e` job to `ci.yml`.

### Unit Test Coverage

- **Status:** CONCERNS ⚠️
- **Threshold:** Adequate unit test coverage for business logic
- **Actual:** Vitest runs with `--passWithNoTests`; no unit test files currently exist. All testing relies on E2E (integration-level) tests.
- **Evidence:** `pnpm check:tests` passes due to `--passWithNoTests`; no `*.test.ts` or `*.test.tsx` files found in `src/`

### Production Error Monitoring

- **Status:** FAIL ❌
- **Threshold:** Production errors must be captured and surfaced for investigation
- **Actual:** No APM, Sentry, Datadog, or equivalent error monitoring configured. Production errors on Vercel deployments will be invisible unless users report them.
- **Evidence:** No error monitoring package in `package.json`; no monitoring configuration in source
- **Recommendation:** For a Phase 1 local tool this is acceptable; for any public-access deployment, add Sentry or equivalent as a prerequisite.

### CI Stability (Burn-In)

- **Status:** CONCERNS ⚠️
- **Threshold (NFR10):** Main-branch CI success rate ≥95% over rolling 30 runs
- **Actual:** No historical CI run data available for measurement. CI is newly established.
- **Evidence:** CI workflow exists and passes currently; no historical baseline available
- **Recommendation:** Monitor CI success rate via GitHub Actions insights over the next 30 push events to establish baseline.

---

## Maintainability Assessment

### Code Quality (Linter)

- **Status:** PASS ✅
- **Threshold:** Zero lint errors; strict Biome configuration
- **Actual:** 40 files checked, zero findings. Key rules enforced: `noBarrelFile`, `noUnusedVariables`, `noUnusedImports`, `useNumberNamespace`, `useImportType`, `useIsNan`, `noDangerouslySetInnerHtmlWithChildren` (the last rule blocks direct usage but does not catch the `marked` rendering pattern used in the codebase)
- **Evidence:** `biome check src/` — clean; `biome.json` shows comprehensive rule set

### TypeScript Strictness

- **Status:** PASS ✅
- **Threshold:** Zero TypeScript errors; `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- **Actual:** `tsc --noEmit` passes with zero errors
- **Evidence:** `pnpm check:types` exits 0; `tsconfig.json` confirms `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`

### Test Quality

- **Status:** PASS ✅
- **Threshold:** Tests must be deterministic, isolated, and explicit
- **Actual:** All Playwright tests use the `captureConsoleErrors` + `mockApi` fixture pattern. No `waitForTimeout` hard waits detected. `page.on("pageerror")` catches JS errors. Fixtures are deterministic JSON with controlled data. `abortRoute` tested for SSE stream handling.
- **Evidence:** `mock-api.ts` helper; consistent pattern across all 5 spec files; no `waitForTimeout` found in test files

### Documentation Completeness

- **Status:** PASS ✅
- **Threshold (NFR17, NFR20):** Setup/deploy/troubleshooting accessible within 2 navigation actions; VS Code workflow documented
- **Actual:** `docs/` directory with index; `README.md`; `CONTRIBUTING.md`; `CODEOWNERS`; issue templates; PR template; architecture.md, prd.md, epics.md complete
- **Evidence:** `.github/CONTRIBUTING.md`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/`, `docs/` directory

### Technical Debt

- **Status:** CONCERNS ⚠️
- **Threshold:** Manageable; no critical debt blocking Phase 2
- **Actual:** `project-context.md` documents known Phase 1 technical debt: all components colocated in `src/routes/` and `src/app.tsx` (no `src/ui/` hierarchy); `src/types.ts` is a legacy global types file; `styles.css` legacy CSS classes. Phase 2 explicitly targets this debt.
- **Evidence:** `project-context.md` — sections marked `[Phase 2 planned]`; architecture.md

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories, 29 criteria)**

| Category | Criteria Met | PASS | CONCERNS | FAIL | Overall Status |
| -------- | ------------ | ---- | -------- | ---- | -------------- |
| 1. Testability & Automation | 3/4 | 3 | 1 | 0 | CONCERNS ⚠️ |
| 2. Test Data Strategy | 3/3 | 3 | 0 | 0 | PASS ✅ |
| 3. Scalability & Availability | 3/4 | 3 | 1 | 0 | CONCERNS ⚠️ |
| 4. Disaster Recovery | 2/3 | 2 | 1 | 0 | CONCERNS ⚠️ |
| 5. Security | 3/4 | 3 | 1 | 0 | CONCERNS ⚠️ |
| 6. Monitorability, Debuggability & Manageability | 2/4 | 2 | 1 | 1 | FAIL ❌ |
| 7. QoS & QoE | 1/4 | 1 | 3 | 0 | CONCERNS ⚠️ |
| 8. Deployability | 3/3 | 3 | 0 | 0 | PASS ✅ |
| **Total** | **20/29** | **20** | **8** | **1** | **CONCERNS ⚠️** |

**Score:** 20/29 (69%) → Room for improvement

---

## Recommended Actions

### Immediate (Before Public Release) — HIGH Priority

1. **Add E2E tests to CI gate** — HIGH — 1h — lorenzogm
   - Add a `e2e` job to `.github/workflows/ci.yml` that runs `playwright test`
   - Or add `pnpm run check:e2e` to the existing `validate` job
   - Validation: `ci.yml` `validate` job includes E2E step; `pnpm check` includes `check:e2e`

2. **Add HTML sanitisation for `marked` output** — HIGH — 2h — lorenzogm
   - Install `dompurify` + `@types/dompurify`
   - Wrap `marked.parse()` output in `DOMPurify.sanitize()` before passing to `dangerouslySetInnerHTML`
   - Affects: `workflow.$phaseId.$stepId.tsx`, `analytics-quality.tsx`, `prepare-story.$storyId.tsx`, `docs.$docId.tsx`
   - Validation: No XSS payload survives `<script>` tag injection in docs route

3. **Implement code splitting / lazy loading** — HIGH — 3h — lorenzogm
   - Use dynamic `import()` for route-level code splitting in TanStack Router
   - Target: reduce initial bundle from 1,610 kB to <600 kB (gzip <200 kB)
   - Validation: Vite build no longer warns about chunk size; Lighthouse TTI <2s on simulated 3G

### Short-term (Phase 2) — MEDIUM Priority

4. **Add Dependabot configuration** — MEDIUM — 30min — lorenzogm
   - Create `.github/dependabot.yml` with weekly pnpm ecosystem updates
   - Validation: Dependabot PRs appear weekly for dependency patches

5. **Add production error monitoring** — MEDIUM — 2h — lorenzogm
   - Add Sentry (or equivalent) for production Vercel deployments
   - Gate behind `IS_LOCAL_MODE` check so it only activates on Vercel
   - Validation: Errors captured in Sentry dashboard; no noise from local dev

6. **Add unit tests for business logic** — MEDIUM — ongoing — lorenzogm
   - Priority targets: analytics aggregation functions, `src/lib/mode.ts`, data transformation utilities
   - Validation: Vitest no longer uses `--passWithNoTests` flag; coverage ≥60% for `src/lib/`

### Long-term (Phase 3) — LOW Priority

7. **Implement session data lazy loading** — LOW — 4h — lorenzogm
   - Replace static data compilation into bundle with dynamic `/data/*.json` fetches
   - Add virtual scrolling / windowing for long session lists (e.g., `@tanstack/react-virtual`)
   - Validation: Build time <5s regardless of session count; analytics page handles 1,000+ sessions without jank

8. **Establish CI burn-in baseline** — LOW — passive — lorenzogm
   - Monitor GitHub Actions run history over 30 consecutive CI runs
   - Target: ≥95% success rate (NFR10)
   - Validation: GitHub Actions insights dashboard shows ≥95% pass rate over 30-day rolling window

---

## Quick Wins

3 quick wins identified for immediate implementation:

1. **Add Dependabot** (Security) — HIGH impact — 30min
   - Create `.github/dependabot.yml` — no code changes required

2. **E2E in CI** (Reliability) — HIGH impact — 1h
   - Single line addition to `ci.yml` runs `pnpm check:e2e`

3. **`marked` sanitisation** (Security) — MEDIUM impact — 2h
   - `pnpm add dompurify @types/dompurify` + 4 one-line wraps in existing route files

---

## Monitoring Hooks

### Performance Monitoring

- [ ] Add Lighthouse CI to CI pipeline — capture LCP, TTI, CLS on every build
  - **Owner:** lorenzogm
  - **Deadline:** Phase 2

- [ ] Track bundle size per commit — alert when JS bundle grows >10% between builds
  - **Owner:** lorenzogm
  - **Deadline:** Phase 2

### Security Monitoring

- [ ] Enable Dependabot security alerts — GitHub native, zero config beyond `dependabot.yml`
  - **Owner:** lorenzogm
  - **Deadline:** Immediate

### Reliability Monitoring

- [ ] Add Sentry to Vercel deployment — capture unhandled React errors in production
  - **Owner:** lorenzogm
  - **Deadline:** Before public launch

### Alerting Thresholds

- [ ] Alert when CI main-branch failure rate exceeds 10% over 10 consecutive runs
  - **Owner:** lorenzogm
  - **Deadline:** Phase 2

---

## Fail-Fast Mechanisms

### Validation Gates (Security)

- [ ] Add `pnpm audit --audit-level=high` as a CI step to block on new high-severity vulnerabilities
  - **Owner:** lorenzogm
  - **Estimated Effort:** 15 min

### Smoke Tests (Maintainability)

- [ ] Add E2E job to CI so smoke regressions block merge
  - **Owner:** lorenzogm
  - **Estimated Effort:** 1h

### Bundle Size Gate (Performance)

- [ ] Add `bundlesize` or `size-limit` check to CI to fail builds that exceed 700 kB gzip JS budget
  - **Owner:** lorenzogm
  - **Estimated Effort:** 1h

---

## Evidence Gaps

4 evidence gaps identified — action required:

- [ ] **Response time benchmark** (Performance / QoS)
  - **Owner:** lorenzogm
  - **Deadline:** Phase 2
  - **Suggested Evidence:** Lighthouse CI in GitHub Actions, or `playwright-cli network` timing measurements
  - **Impact:** Cannot confirm NFR3 (<3s render) without measurement

- [ ] **Session sync daemon performance** (QoS — NFR23)
  - **Owner:** lorenzogm
  - **Deadline:** Phase 2
  - **Suggested Evidence:** Add timing instrumentation to `sync-sessions.mjs` startup; log elapsed time on first full-history sync
  - **Impact:** Cannot confirm NFR23 (<30s startup processing) without evidence

- [ ] **Analytics 500-session performance** (QoS — NFR25)
  - **Owner:** lorenzogm
  - **Deadline:** Phase 2
  - **Suggested Evidence:** Playwright performance test loading analytics page with 500-session fixture; measure time to interactive
  - **Impact:** Cannot confirm NFR25 without benchmark

- [ ] **CI 30-run success rate baseline** (Reliability — NFR10)
  - **Owner:** lorenzogm
  - **Deadline:** Passive (30 CI runs)
  - **Suggested Evidence:** GitHub Actions run history (30-day window)
  - **Impact:** Cannot confirm NFR10 (≥95% success rate) without historical data

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-04-23'
  story_id: 'N/A'
  feature_name: 'bmad-ui platform (full assessment)'
  adr_checklist_score: '20/29'
  categories:
    testability_automation: 'CONCERNS'
    test_data_strategy: 'PASS'
    scalability_availability: 'CONCERNS'
    disaster_recovery: 'CONCERNS'
    security: 'CONCERNS'
    monitorability: 'FAIL'
    qos_qoe: 'CONCERNS'
    deployability: 'PASS'
  overall_status: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 3
  medium_priority_issues: 4
  concerns: 8
  blockers: false  # Acceptable for local-only Phase 1 tool; FAIL is production-monitoring gap only
  quick_wins: 3
  evidence_gaps: 4
  recommendations:
    - 'Add E2E tests to CI gate (ci.yml) — most impactful single change'
    - 'Add DOMPurify sanitisation for marked HTML output in 4 routes'
    - 'Implement route-level code splitting to reduce 1.6MB bundle'
```

---

## Related Artifacts

- **PRD:** `_bmad-output/planning-artifacts/prd.md`
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md`
- **Project Context:** `_bmad-output/project-context.md`
- **Playwright Config:** `_bmad-ui/playwright.config.ts`
- **CI Workflow:** `.github/workflows/ci.yml`
- **CodeQL Workflow:** `.github/workflows/codeql.yml`
- **Evidence Sources:**
  - Test files: `_bmad-ui/tests/`
  - Build output: `_bmad-ui/dist/` (analysed at assessment time)
  - Biome lint: `_bmad-ui/biome.json`
  - TypeScript: `_bmad-ui/tsconfig.json`

---

## Recommendations Summary

**Release Blocker:** None for Phase 1 local-only use case. The Monitorability FAIL (no APM) is a prerequisite before any public multi-user deployment.

**High Priority:** E2E in CI gate, `marked` HTML sanitisation, bundle code splitting.

**Medium Priority:** Dependabot, Sentry, unit tests for business logic.

**Next Steps:** Address the 3 quick wins (Dependabot, E2E in CI, `marked` sanitisation) in the current sprint as they are high-value and low-effort. Schedule bundle optimisation and unit test expansion for Phase 2.

---

## Sign-Off

**NFR Assessment:**

- Overall Status: CONCERNS ⚠️
- Critical Issues: 0
- High Priority Issues: 3
- Concerns: 8
- Evidence Gaps: 4

**Gate Status:** CONCERNS ⚠️ — proceed with documented remediation plan

**Next Actions:**

- CONCERNS ⚠️: Address 3 HIGH priority items (E2E in CI, `marked` sanitisation, code splitting), then re-run `*nfr-assess` before public launch
- Optional next workflow: `bmad-testarch-trace` to generate traceability matrix for NFR coverage

**Generated:** 2026-04-23
**Workflow:** testarch-nfr v5.0 (sequential mode)

---

<!-- Powered by BMAD-CORE™ -->
