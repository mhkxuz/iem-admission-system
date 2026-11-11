# Stage 8 — Comprehensive Testing, Integration & Quality Assurance

## Scope

Stage 8 validates the complete Stages 1–7 admission system through backend integration tests,
replica-set transaction tests, expanded Angular component/service tests, a production build and an
isolated persistent-MongoDB HTTP smoke test. No Stage 9 work, new features or large refactors were
introduced. Existing architecture and previous-stage documentation were preserved.

## Files

### Created

- `backend/tests/stage8.integration.test.js` — end-to-end applicant, administrator, security and data-integrity tests.
- `backend/tests/stage8.replica.test.js` — replica-set transaction and concurrent-update tests.
- `frontend/src/app/core/guards/auth.guard.spec.ts` — authentication and role guard tests.
- `frontend/src/app/core/interceptors/auth.interceptor.spec.ts` — bearer-token interceptor tests.
- `frontend/src/app/core/services/auth.service.spec.ts` — registration, login, profile and logout tests.
- `frontend/src/app/core/services/document.service.spec.ts` — multipart upload, listing and blob download tests.
- `frontend/src/app/features/auth/login/login.component.spec.ts` — login validation and error tests.
- `frontend/src/app/features/auth/register/register.component.spec.ts` — registration validation, duplicate error and navigation tests.
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.spec.ts` — dashboard, document, upload, loading/empty/error and retry tests.
- `frontend/src/app/features/applicant/application-form/application-form.component.spec.ts` — prefill, validation, duplicate-application and submission tests.
- `frontend/src/app/features/admin/dashboard/admin-dashboard-applications.spec.ts` — application listing, empty/error/retry, filtering and sorting tests.
- `frontend/src/app/shared/components/navbar/navbar.component.spec.ts` — guest, applicant and administrator navigation tests.
- `docs/STAGE8_TESTING_QA.md` — this document.

### Modified

- `backend/middleware/error.middleware.js` — HTTP 500 responses now always return the generic message `Internal Server Error` and never expose internal exception text.
- `backend/services/application.service.js` — if the initial audit-history insert fails, the newly created application is deleted so an application cannot exist without its submission history.
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts` — application-list requests now expose an error message with a retry action instead of silently showing an empty table.
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts` — document-list requests now expose an error message with a retry action; document retry also guards against a missing application ID.
- `frontend/src/app/features/auth/login/login.component.ts` — removed the seeded administrator credentials from the login screen.

## Test coverage

### Backend

Command: `cd backend && npm test`

| Suites | Tests |
| --- | --- |
| 9 passed | 129 passed |

Stage 8 added 8 tests (5 integration + 3 replica-set). The full suite continues to cover Stages 1–7.

The integration suite verifies:

- Health endpoint and database connectivity.
- Registration, forced applicant role, password hashing and password non-exposure.
- Duplicate registration and duplicate application prevention.
- Login, logout/re-login and application persistence.
- Application submission with server-controlled `Submitted` status and generated `IEM-2026-XXXXX` ID.
- Initial audit-history creation.
- Document upload, metadata, listing, inline view and download.
- Administrator login, dashboard statistics, listing, search by name and application ID, filters, sorting and pagination.
- Detailed application and document inspection.
- `Submitted → Under Review → Selected` transitions and terminal-state rejection.
- Audit-history ordering, actor roles and applicant visibility of the updated status.
- Applicant isolation, administrator-only endpoints, application/document IDOR and unauthenticated access.
- Safe 500 responses and submission rollback when audit-history creation fails.

The replica-set suite verifies:

- Replica-set detection and transactional status updates.
- Transaction rollback when audit insertion fails.
- One winner under concurrent administrator status updates.

### Frontend

Command: `cd frontend && npx ng test --watch=false`

| Test files | Tests |
| --- | --- |
| 14 passed | 57 passed |

New coverage includes guards, the interceptor, auth service, document service, login, register,
navbar, applicant dashboard, application form and admin application listing/error states. Existing
Stage 6 status and Stage 7 aggregation specs remain in place.

### Production build

Command: `cd frontend && npm run build`

Result: success. Initial bundle `301.55 kB` raw / `81.60 kB` estimated transfer, no build warnings or errors.

## Persistent MongoDB smoke test

An isolated database (`iem_stage8_smoke_20261110`), isolated upload directory
(`backend/uploads/stage8-smoke`) and dedicated port (`5108`) were used. Existing databases were not
modified. The smoke test performed 57 real HTTP assertions:

1. Health endpoint returned `200` with MongoDB connected.
2. Applicant registration returned `201`, forced the applicant role, never returned the password and rejected a duplicate email with `409`.
3. Login issued a JWT; a new applicant had no application.
4. Application submission returned `201`, forced `Submitted`, generated an application ID and rejected a duplicate with `409`.
5. Document upload returned `201` with correct MIME type and filename; listing, inline view and download all returned the stored PDF.
6. Applicants received `403` from administrator endpoints and cross-role status updates; unauthenticated access returned `401`.
7. Seeded administrator login, dashboard statistics, search by application ID, detailed inspection and document access succeeded.
8. Status transitions to `Under Review` and `Selected` succeeded, invalid terminal transitions returned `400`, audit history contained three entries and applicant dashboards reflected the new status.
9. After stopping and restarting the backend, applicant and administrator login, application data, document metadata, the stored file, audit history and dashboard aggregation all persisted.

The isolated database and upload directory were removed after verification. The pre-existing
`iem_admission_db` database was left untouched.

Replica-set behavior is covered by `stage8.replica.test.js` using `MongoMemoryReplSet`; this was not
run against a persistent production replica set.

## Security fixes

- **Internal error leakage:** unexpected `500` responses previously returned the raw exception message. All server errors now return `Internal Server Error`.
- **Audit-history integrity:** a failed initial history insert could leave an application with no submission audit record. Submission now compensates by deleting the newly created application before returning the error.
- **Credential exposure:** seeded administrator credentials were displayed on the login screen and have been removed.
- **Silent client failures:** administrator application-list and applicant document-list failures now show an explicit error with retry instead of an empty state.

## Known limitations

- The real-application smoke test used HTTP requests, not browser automation. UI behavior is covered by Angular tests and the production build; no manual browser session was performed.
- Replica-set transactions were verified with an in-memory replica set, not a persistent deployment.
- The persistent smoke test exercised one applicant and one administrator; broader concurrency remains covered by automated tests rather than the persistent environment.
- The repository is not under Git, so changes are not represented by commits.

## Project status

Stages 1–8 are complete. Stage 9 documentation and demonstration preparation have not been started.
