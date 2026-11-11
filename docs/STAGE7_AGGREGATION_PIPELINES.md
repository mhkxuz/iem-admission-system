# Stage 7 — MongoDB Aggregation Pipelines for Dashboard Statistics

## Scope

Stage 7 replaces the Stage 5 dashboard counting approach (`countDocuments`) with real MongoDB
aggregation pipelines executed through Mongoose. All Stage 1–6 behavior is preserved, including the
status workflow, audit history, application submission and authentication.

## Files

### Created

- `backend/services/dashboard-statistics.service.js` — dashboard aggregation pipelines and result shaping.
- `backend/tests/stage7.test.js` — dedicated aggregation, authorization and empty-state tests.
- `frontend/src/app/features/admin/dashboard/admin-dashboard-aggregation.spec.ts` — dashboard rendering, loading, empty and error-state tests.
- `docs/STAGE7_AGGREGATION_PIPELINES.md` — this document.

### Modified

- `backend/services/admin.service.js` — `getDashboardOverview` now delegates statistics to the aggregation service and still returns recent applications.
- `frontend/src/app/core/services/admin.service.ts` — added distribution types to `AdminDashboardData`.
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts` — displays aggregation results, distribution bars, loading/empty/error states and retry.
- `frontend/angular.json` — raised the `anyComponentStyle` warning budget from 10 kB to 12 kB for the expanded dashboard styles.

## Aggregation pipelines

All pipelines live in `backend/services/dashboard-statistics.service.js` and use MongoDB `$match`
and `$group` stages.

### Total applications

```js
[
  { $match: {} },
  { $group: { _id: null, count: { $sum: 1 } } }
]
```

The explicit `$match` stage leaves room for a future academic-session or status filter without
changing the pipeline shape.

### Status distribution

```js
[
  { $match: { status: { $in: ['Submitted', 'Under Review', 'Selected', 'Rejected'] } } },
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]
```

The service then maps the aggregated rows onto the canonical workflow order and inserts explicit
zero counts for statuses that have no applications.

### Department distribution

```js
[
  { $match: { 'admissionInfo.preferredDepartment': { $type: 'string' } } },
  { $group: { _id: '$admissionInfo.preferredDepartment', count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } }
]
```

### Admission category distribution

```js
[
  { $match: { 'admissionInfo.admissionCategory': { $type: 'string' } } },
  { $group: { _id: '$admissionInfo.admissionCategory', count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } }
]
```

Departments and categories are sorted by descending count, then name for deterministic output.
Documents missing the grouped field are excluded from that distribution.

## API response

The existing endpoint is reused unchanged:

```http
GET /api/admin/dashboard
Authorization: Bearer <admin-token>
```

Response `data` now contains:

```json
{
  "metrics": {
    "totalApplications": 7,
    "submitted": 2,
    "underReview": 2,
    "selected": 2,
    "rejected": 1
  },
  "statusDistribution": [
    { "status": "Submitted", "count": 2 },
    { "status": "Under Review", "count": 2 },
    { "status": "Selected", "count": 2 },
    { "status": "Rejected", "count": 1 }
  ],
  "departmentDistribution": [
    { "department": "Computer Science & Engineering", "count": 3 }
  ],
  "categoryDistribution": [
    { "category": "General", "count": 3 }
  ],
  "recentApplications": []
}
```

- Empty collections return zero metrics, four zero-count status entries and empty department/category arrays.
- The route remains protected by `authenticate` + `requireAdmin`: unauthenticated requests receive 401 and applicants receive 403.

## Frontend

The existing administrator dashboard now displays:

- The total application count in the existing metric cards.
- Status distribution as proportional bars, with the same values as the status metric cards.
- Department-wise application distribution.
- Admission-category distribution.

The dashboard uses plain CSS bars and grid layout, so no charting dependency was added. It handles:

- **Loading:** spinner and status text while the aggregation request is pending.
- **Empty:** a message when no applications exist.
- **Error:** an error panel with a retry button.

Applicant dashboards are unchanged and do not receive administrative statistics.

## Testing

### Backend — `backend/tests/stage7.test.js`

1. Empty database returns zeros and explicit zero-count statuses.
2. Mixed data aggregates multiple departments, categories and all four statuses.
3. Statuses without applications are represented with zero.
4. Service results match direct MongoDB `$group` operations.
5. `Application.aggregate` is called with four real pipelines, each containing `$match` and `$group`.
6. The dashboard API returns aggregation results for an administrator.
7. Unauthenticated dashboard access returns 401.
8. Applicant dashboard access returns 403.

### Frontend — `admin-dashboard-aggregation.spec.ts`

1. Total, status, department and category results render correctly.
2. Loading state is shown until the dashboard request resolves.
3. Empty state is shown for an empty database.
4. Error state is shown and retry re-issues the dashboard request.

## Verification results

| Check | Result |
| --- | --- |
| Backend suite (Stages 1–7) | 7 suites, 121 tests passed |
| Angular suite | 4 files, 13 tests passed |
| Angular production build | Successful |
| Persistent MongoDB aggregation verification | Passed (see below) |

### Persistent MongoDB verification

A temporary verification script connected to a standalone persistent `mongod` instance, inserted
seven applications across four departments, five categories and all four statuses, and ran the
Stage 7 service against the real database. The script asserted:

- total applications = 7;
- Submitted = 2, Under Review = 2, Selected = 2, Rejected = 1;
- department grouping `Computer Science & Engineering` = 3, `Information Technology` = 2, and one each for Biotechnology and Mechanical Engineering;
- category grouping `General` = 3, with one each for EWS, Management, OBC and SC;
- the service total matched a separately executed MongoDB `$group` pipeline.

The temporary verification database was dropped after the checks.

## Limitations

- Distributions only include departments/categories that currently have applications; no zero-count
  entries are emitted for those dimensions. Status distribution intentionally includes all four
  expected statuses with zero values.
- The dashboard statistics are global across academic sessions. The `$match` stage in the total
  pipeline is intentionally explicit so session filtering can be added later.
