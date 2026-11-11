# Stage 6 — Application Status Workflow & Audit History

This document describes the Stage 6 implementation added to the existing IEM Online Admission System. Stages 1–5 remain intact.

## Status workflow

The admission lifecycle is a strict state machine:

```text
Submitted ──> Under Review ──> Selected
                           └─> Rejected
```

Permitted transitions:

| Current status | Permitted next statuses |
| --- | --- |
| Submitted | Under Review |
| Under Review | Selected, Rejected |
| Selected | None (terminal) |
| Rejected | None (terminal) |

All other transitions are rejected with HTTP `400`:

- Submitted → Selected
- Submitted → Rejected
- Selected → Rejected
- Rejected → Selected
- Any transition out of Selected or Rejected
- Any transition to an unknown status

The rules live in one reusable module: `backend/services/status-workflow.service.js`.

## API

### `PATCH /api/admin/applications/:id/status`

Administrator-only endpoint. The route is protected by the existing authentication and admin-role middleware.

Request body:

```json
{
  "status": "Under Review",
  "remarks": "Optional administrator note"
}
```

Rules:

- `status` is required and must be a valid application status.
- `remarks` is optional, trimmed, and limited to 1000 characters.
- The previous status is always read from MongoDB.
- The administrator identity comes from `req.userId` (the authenticated JWT user).
- Client-supplied `changedBy`, `previousStatus`, `newStatus`, or applicant identifiers are ignored.
- The application ID may be either the MongoDB `_id` or the public `IEM-...` application ID.

Response status codes:

| Situation | Status |
| --- | --- |
| Successful transition | `200` |
| Missing/invalid status or invalid transition | `400` |
| Unauthenticated | `401` |
| Authenticated applicant | `403` |
| Application not found | `404` |
| Concurrent conflicting update | `409` |

Successful response data contains the updated application, the created audit entry, previous/new status, and the permitted next statuses.

## Database consistency

Status changes and audit records must stay consistent.

1. **Preferred path — MongoDB transactions.** When the connected deployment is a replica set or sharded cluster, the status update and audit-history insert run in a single transaction.
2. **Fallback — standalone MongoDB.** Standalone `mongod` deployments do not support multi-document transactions. The service therefore:
   - writes the audit record first,
   - applies the status change using an atomic conditional update (`_id` + expected current status),
   - deletes the audit record if the update fails.
3. **Concurrency.** The conditional update means only one simultaneous administrator update can succeed. Other requests receive HTTP `409` and their audit record is removed. A status can never change without a corresponding audit record.

## Audit history

The existing `ApplicationStatusHistory` model is reused. Each entry stores:

- application reference,
- previous status,
- new status,
- `changedBy` (User reference),
- timestamp,
- optional remarks.

The initial submission entry created by Stage 3 remains unchanged. Its `changedBy` points to the applicant, while later entries point to the administrator who performed the transition. The administrator inspection response includes `allowedNextStatuses` and history ordered oldest-first.

## Frontend

The existing administrator inspection modal now contains:

- current status display,
- only the permitted next-status options,
- optional remarks input,
- confirmation button and inline success/error messages,
- chronological audit trail with previous status, new status, responsible user/role, timestamp, and remarks.

Terminal applications display a terminal-state message instead of controls.

The applicant dashboard is preserved and continues to show the latest status and progress indicator. Applicants never receive administrative controls or access to the admin API.

## Automated tests

### Backend — `backend/tests/stage6.test.js`

33 tests covering:

- all three valid transitions,
- all required invalid/terminal/unknown transitions,
- missing and malformed application IDs,
- unauthenticated and applicant access,
- administrator access,
- client impersonation attempts,
- applicants modifying status through submission/retrieval endpoints,
- exactly one audit record per successful transition,
- previous/new status, administrator identity, and remarks,
- preservation of the initial applicant submission entry,
- failed transitions creating no history,
- rollback when the application update or audit insert fails,
- concurrent identical and conflicting administrator updates.

Run:

```bash
cd backend
npm test
```

### Frontend — Angular specs

- `frontend/src/app/core/services/admin.service.spec.ts` verifies the `PATCH` URL and payload.
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.spec.ts` verifies permitted options, radio binding, successful UI/history updates, meaningful failure messages, and terminal-state behavior.

Run:

```bash
cd frontend
npx ng test --watch=false
```

## Verification results

- Full backend suite: **113 tests passed** (6 suites).
- Angular unit tests: **9 tests passed** (3 files).
- Angular production build: **successful**.
- Replica-set verification: transaction path passed.
- Persistent standalone MongoDB verification: status and audit history persisted correctly; invalid transition rejected with `400`.

## Known limitations

- The fallback path is used only when transactions are unavailable. It is safe against concurrent updates through the conditional status update, but a process crash between the audit insert and the status update could leave an orphan audit record (the application status itself remains unchanged). Transactions avoid this on replica-set deployments.
- The UI derives permitted next statuses from the backend response, so a stale inspection view is rejected by the server rather than trusted client-side.
