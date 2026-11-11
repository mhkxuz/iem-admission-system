# API Reference

Base URL for local development:

```text
http://localhost:5000/api
```

All request and response bodies are JSON unless an endpoint explicitly accepts or returns a file.
Protected endpoints require:

```http
Authorization: Bearer <jwt>
```

## Response envelope

Success:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

Paginated success responses add a `meta` object:

```json
{
  "success": true,
  "message": "Applications retrieved successfully.",
  "data": [],
  "meta": {
    "totalRecords": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

Error:

```json
{
  "success": false,
  "message": "Description of the problem"
}
```

Validation failures can include an `errors` array. Unexpected HTTP 500 responses always use the
generic message `Internal Server Error`; internal exception details are not exposed.

## Common status codes

| Code | Meaning |
| --- | --- |
| `200` | Request succeeded |
| `201` | Resource created |
| `400` | Validation error, malformed identifier or invalid status transition |
| `401` | Missing, invalid or expired authentication |
| `403` | Authenticated but not allowed (role or ownership failure) |
| `404` | Resource or route not found |
| `409` | Duplicate resource or concurrent-update conflict |
| `500` | Unexpected server error |

## Health

### `GET /api/health`

Public health and database-status endpoint.

**Authentication:** none  
**Role:** none

**Success `200`:**

```json
{
  "success": true,
  "message": "IEM Admission System API is running smoothly",
  "data": {
    "service": "IEM Admission System Backend",
    "status": "healthy",
    "database": "connected",
    "timestamp": "2026-11-10T12:00:00.000Z",
    "environment": "development"
  }
}
```

If MongoDB is not connected, `status` is `degraded`, `database` reflects the Mongoose connection
state and the HTTP status is `503`.

---

## Authentication

### `POST /api/auth/register`

Create an applicant account. The server always forces the role to `applicant`, even if the request
body contains another role.

**Authentication:** none  
**Role:** none

**Request body:**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `fullName` | string | yes | 2–100 characters |
| `email` | string | yes | Valid email; normalised to lowercase; unique |
| `password` | string | yes | At least 6 characters |
| `phone` | string | no | 10–12 digits after removing spaces, `-`, `+`, `(` and `)` |

```json
{
  "fullName": "Asha Roy",
  "email": "asha.roy@example.com",
  "password": "choose-a-strong-password",
  "phone": "9830000001"
}
```

**Success `201`:**

```json
{
  "success": true,
  "message": "Registration successful. Welcome to IEM Admission Portal.",
  "data": {
    "token": "<jwt>",
    "user": {
      "_id": "<userId>",
      "fullName": "Asha Roy",
      "email": "asha.roy@example.com",
      "role": "applicant",
      "phone": "9830000001",
      "createdAt": "2026-11-10T12:00:00.000Z",
      "updatedAt": "2026-11-10T12:00:00.000Z"
    }
  }
}
```

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Missing/invalid fields |
| `409` | Email already registered |
| `500` | Unexpected server failure |

### `POST /api/auth/login`

Authenticate an applicant or administrator.

**Authentication:** none  
**Role:** none

**Request body:**

| Field | Type | Required |
| --- | --- | --- |
| `email` | string | yes, valid email |
| `password` | string | yes, non-empty |

**Success `200`:** same `{ token, user }` shape as registration.

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Missing/invalid email or password |
| `401` | Incorrect email or password (same generic message for both) |
| `500` | Unexpected server failure |

### `GET /api/auth/me`

Return the authenticated user's profile.

**Authentication:** Bearer JWT  
**Role:** any authenticated user

**Success `200`:**

```json
{
  "success": true,
  "message": "User profile retrieved successfully.",
  "data": {
    "_id": "<userId>",
    "fullName": "Asha Roy",
    "email": "asha.roy@example.com",
    "role": "applicant",
    "phone": "9830000001",
    "createdAt": "2026-11-10T12:00:00.000Z",
    "updatedAt": "2026-11-10T12:00:00.000Z"
  }
}
```

**Errors:** `401` missing/invalid/expired token or deleted user; `500` unexpected failure.

### RBAC verification helpers

These endpoints exist to verify middleware behavior and are useful during demonstration/testing.

#### `GET /api/auth/test-admin`

**Authentication:** Bearer JWT  
**Role:** `admin`

Returns `200` with `{ "role": "admin" }` and message `Admin authorization verified.`

**Errors:** `401` unauthenticated; `403` authenticated non-admin.

#### `GET /api/auth/test-applicant`

**Authentication:** Bearer JWT  
**Role:** `applicant`

Returns `200` with `{ "role": "applicant" }` and message `Applicant authorization verified.`

**Errors:** `401` unauthenticated; `403` authenticated non-applicant.

---

## Applications

### `POST /api/applications`

Submit the authenticated applicant's admission application.

**Authentication:** Bearer JWT  
**Role:** `applicant`

The server derives `applicant`, `applicationId`, `status` and `submittedAt`. Client values for those
fields are ignored. The generated ID has the form `IEM-<session-year>-<5 characters>`.

**Request body:**

```json
{
  "academicSession": "2026-2027",
  "personalInfo": {
    "fullName": "Asha Roy",
    "dob": "2005-04-12",
    "gender": "Female",
    "email": "asha.roy@example.com",
    "phone": "9830000001",
    "address": "12 Salt Lake Sector V",
    "state": "West Bengal",
    "city": "Kolkata",
    "pincode": "700091"
  },
  "academicInfo": {
    "class10Board": "ICSE",
    "class10Percentage": 91.5,
    "class12Board": "ISC",
    "class12Percentage": 93.2,
    "class12PassingYear": 2024,
    "entranceExamName": "WBJEE",
    "entranceExamScore": "Rank 1520"
  },
  "admissionInfo": {
    "preferredDepartment": "Information Technology",
    "admissionCategory": "General"
  }
}
```

**Field rules:**

| Section | Field | Rules |
| --- | --- | --- |
| personalInfo | `fullName` | Required, at least 2 characters |
| personalInfo | `dob` | Required valid past date |
| personalInfo | `gender` | `Male`, `Female` or `Other` |
| personalInfo | `email` | Required valid email |
| personalInfo | `phone` | Required, at least 10 characters |
| personalInfo | `address` | Required, at least 5 characters |
| personalInfo | `state`, `city` | Required |
| personalInfo | `pincode` | Exactly 6 digits |
| academicInfo | `class10Board`, `class12Board` | Required |
| academicInfo | `class10Percentage`, `class12Percentage` | Number from 0 to 100 |
| academicInfo | `class12PassingYear` | Number from 2000 to 2030 |
| academicInfo | `entranceExamName` | Required |
| academicInfo | `entranceExamScore` | Required rank or score |
| admissionInfo | `preferredDepartment` | One of the six supported departments |
| admissionInfo | `admissionCategory` | `General`, `OBC`, `SC`, `ST`, `EWS` or `Management` |
| academicSession | `academicSession` | Optional string; defaults to `2026-2027` |

Supported departments:

- Computer Science & Engineering
- Information Technology
- Electronics & Communication Engineering
- Electrical Engineering
- Mechanical Engineering
- Biotechnology

**Success `201`:** the created application document with generated `applicationId`, applicant
reference, submission status and timestamps.

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Missing section or invalid field |
| `401` | Unauthenticated |
| `403` | Authenticated administrator attempting applicant-only submission |
| `409` | Applicant already has an application for the same academic session |
| `500` | Unexpected failure; a failed initial audit insert rolls back the new application |

### `GET /api/applications/my-application`

Return the authenticated applicant's application for dashboard display.

**Authentication:** Bearer JWT  
**Role:** `applicant`

**Success `200` when an application exists:** application object with populated `documents` and
`statusHistory`. Each history actor includes `fullName` and `role`.

**Success `200` when none exists:**

```json
{
  "success": true,
  "message": "No application submitted yet.",
  "data": null
}
```

**Errors:** `401` unauthenticated; `403` non-applicant; `500` unexpected failure.

### `GET /api/applications/:id`

Return a specific application. The identifier may be a MongoDB ObjectId or an application ID such as
`IEM-2026-12345`.

**Authentication:** Bearer JWT  
**Role:** any authenticated user, with ownership enforcement

**Path parameters:**

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Application ObjectId or `IEM-...` application ID |

- An applicant may read only an application whose `applicant` matches their user ID.
- An administrator may read any application.

**Success `200`:** application with populated applicant summary, `documents`, `statusHistory` and
history actors.

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Malformed MongoDB ObjectId |
| `401` | Unauthenticated |
| `403` | Applicant requesting another applicant's application |
| `404` | Application not found |
| `500` | Unexpected failure |

---

## Documents

### `POST /api/documents/upload`

Upload a document and attach it to the applicant's application.

**Authentication:** Bearer JWT  
**Role:** `applicant`  
**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `document` | file | yes | `.pdf`, `.jpg`, `.jpeg` or `.png`; maximum 5 MB |
| `applicationId` | string | yes | Application ObjectId or `IEM-...` ID |
| `documentType` | string | yes | One of the values below |

Document types:

- `Class 10 Marksheet`
- `Class 12 Marksheet`
- `Entrance Examination Scorecard`
- `Photograph`
- `Other Supporting Documents`
- `Other`

The middleware verifies the extension, declared MIME type and actual file magic bytes. The stored
file gets a randomised name; the original name is preserved only as display metadata.

**Example:**

```bash
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer <applicant-jwt>" \
  -F "applicationId=<applicationId>" \
  -F "documentType=Class 12 Marksheet" \
  -F "document=@/path/to/marksheet.pdf"
```

**Success `201`:**

```json
{
  "success": true,
  "message": "Document uploaded successfully.",
  "data": {
    "_id": "<documentId>",
    "application": "<applicationObjectId>",
    "applicant": "<applicantUserId>",
    "documentType": "Class 12 Marksheet",
    "originalFileName": "marksheet.pdf",
    "storedFileName": "doc_1760000000000_ab12cd34ef56gh78.pdf",
    "filePath": "uploads/documents/doc_1760000000000_ab12cd34ef56gh78.pdf",
    "mimeType": "application/pdf",
    "fileSize": 12345,
    "uploadedAt": "2026-11-10T12:00:00.000Z"
  }
}
```

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Missing file, invalid extension/MIME/signature, invalid document type, missing ID, oversize file or malformed application ID |
| `401` | Unauthenticated |
| `403` | Uploading to another applicant's application |
| `404` | Application not found |
| `500` | Unexpected storage/database failure |

Failed uploads are removed from disk.

### `GET /api/documents/application/:applicationId`

List document metadata for an application. The identifier may be a MongoDB ObjectId or
`IEM-...` ID.

**Authentication:** Bearer JWT  
**Role:** owner applicant or administrator

**Path parameters:**

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `applicationId` | string | yes | Application ObjectId or `IEM-...` application ID |

**Success `200`:** array of document metadata records, newest first.

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Malformed application ObjectId |
| `401` | Unauthenticated |
| `403` | Applicant requesting another applicant's documents |
| `404` | Application not found |
| `500` | Unexpected failure |

### `GET /api/documents/:id/view`

Stream a document inline in the browser.

**Authentication:** Bearer JWT  
**Role:** owner applicant or administrator

**Path parameters:**

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Document ObjectId |

**Success `200`:** binary file with the verified MIME type, `Content-Disposition: inline`, sanitised
filename, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'`.

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Malformed document ObjectId |
| `401` | Unauthenticated |
| `403` | Applicant accessing another applicant's document, or path-traversal guard triggered |
| `404` | Document record or file on disk not found |
| `500` | Unexpected failure |

### `GET /api/documents/:id/download`

Download a document as an attachment.

**Authentication:** Bearer JWT  
**Role:** owner applicant or administrator

**Success `200`:** binary file with `Content-Disposition: attachment` and a sanitised filename.

**Errors:** same as the view endpoint.

---

## Administrator

All administrator endpoints require a valid JWT with role `admin`.

### `GET /api/admin/applications`

List applications with server-side search, filtering, sorting and pagination.

**Authentication:** Bearer JWT  
**Role:** `admin`

**Query parameters:**

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `search` | string | none | Case-insensitive match on application ID, application `personalInfo.fullName` or application `personalInfo.email` (not the linked user account email) |
| `department` | string | none | Exact preferred department |
| `category` | string | none | Exact admission category |
| `status` | string | none | `Submitted`, `Under Review`, `Selected` or `Rejected` |
| `session` | string | none | Exact academic session |
| `sortBy` | string | `submittedAt` | `submittedAt`, `applicationId`, `name`, `percentage` or `status` |
| `sortOrder` | string | `desc` | `asc` or `desc` |
| `page` | integer | `1` | Minimum 1 |
| `limit` | integer | `10` | 1–100 |

**Success `200`:** array of application documents plus pagination `meta`.

**Errors:**

| Code | Condition |
| --- | --- |
| `401` | Unauthenticated |
| `403` | Authenticated non-administrator |
| `500` | Unexpected query failure |

### `GET /api/admin/applications/:id`

Retrieve full administrative details for an application. The identifier may be a MongoDB ObjectId or
an `IEM-...` application ID.

**Authentication:** Bearer JWT  
**Role:** `admin`

**Success `200`:**

```json
{
  "success": true,
  "message": "Application details retrieved.",
  "data": {
    "_id": "<applicationObjectId>",
    "applicationId": "IEM-2026-12345",
    "applicant": {
      "_id": "<userId>",
      "fullName": "Asha Roy",
      "email": "asha.roy@example.com",
      "phone": "9830000001",
      "createdAt": "2026-11-10T12:00:00.000Z"
    },
    "personalInfo": {},
    "academicInfo": {},
    "admissionInfo": {},
    "status": "Under Review",
    "submittedAt": "2026-11-10T12:00:00.000Z",
    "documents": [],
    "statusHistory": [],
    "allowedNextStatuses": ["Selected", "Rejected"]
  }
}
```

`statusHistory` is chronological (oldest first) and each actor includes `fullName`, `role` and
`email`.

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Malformed MongoDB ObjectId |
| `401` | Unauthenticated |
| `403` | Authenticated non-administrator |
| `404` | Application not found |
| `500` | Unexpected failure |

### `PATCH /api/admin/applications/:id/status`

Move an application through the allowed status workflow and create an audit-history entry.

**Authentication:** Bearer JWT  
**Role:** `admin`

**Request body:**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `status` | string | yes | Must be a permitted next status |
| `remarks` | string | no | Maximum 1000 characters |

Any client-supplied `changedBy`, `previousStatus` or applicant identity is ignored. The administrator
comes from the JWT and the previous status comes from MongoDB.

**Allowed transitions:**

```text
Submitted -> Under Review
Under Review -> Selected
Under Review -> Rejected
```

`Selected` and `Rejected` are terminal.

**Example:**

```json
{
  "status": "Under Review",
  "remarks": "Academic documents verified."
}
```

**Success `200`:**

```json
{
  "success": true,
  "message": "Application status updated from 'Submitted' to 'Under Review'.",
  "data": {
    "application": {},
    "history": {},
    "previousStatus": "Submitted",
    "newStatus": "Under Review",
    "allowedNextStatuses": ["Selected", "Rejected"]
  }
}
```

**Errors:**

| Code | Condition |
| --- | --- |
| `400` | Missing/invalid status, invalid transition, terminal-state change, non-string or overlong remarks, malformed ID |
| `401` | Unauthenticated |
| `403` | Authenticated non-administrator |
| `404` | Application not found |
| `409` | Another administrator changed the status concurrently |
| `500` | Unexpected failure; transaction/compensation prevents partial status-only writes |

---

## Dashboard statistics

### `GET /api/admin/dashboard`

Return dashboard counts, distributions and the five most recent applications. Statistics are
computed with MongoDB aggregation pipelines in
`backend/services/dashboard-statistics.service.js`.

**Authentication:** Bearer JWT  
**Role:** `admin`

**Success `200`:**

```json
{
  "success": true,
  "message": "Admin dashboard metrics retrieved.",
  "data": {
    "metrics": {
      "totalApplications": 8,
      "submitted": 3,
      "underReview": 2,
      "selected": 2,
      "rejected": 1
    },
    "statusDistribution": [
      { "status": "Submitted", "count": 3 },
      { "status": "Under Review", "count": 2 },
      { "status": "Selected", "count": 2 },
      { "status": "Rejected", "count": 1 }
    ],
    "departmentDistribution": [
      { "department": "Information Technology", "count": 4 }
    ],
    "categoryDistribution": [
      { "category": "General", "count": 5 }
    ],
    "recentApplications": []
  }
}
```

`statusDistribution` always contains all four statuses, including explicit zero counts. Department
and category arrays are sorted by count descending, then name. `recentApplications` is sorted by
`submittedAt` descending and limited to five records.

**Errors:**

| Code | Condition |
| --- | --- |
| `401` | Unauthenticated |
| `403` | Authenticated non-administrator |
| `500` | Unexpected aggregation failure; response is generic |

---

## Route-level notes

- Unknown routes return `404` with `Endpoint not found: <METHOD> <URL>`.
- CORS allows the configured `CORS_ORIGIN`, credentials, the standard HTTP methods and the
  `Content-Type`/`Authorization` headers.
- JSON and URL-encoded bodies are limited to 10 MB at the Express parser level; document uploads have
  a separate 5 MB Multer limit.
- `GET /api/applications/:id` is authenticated for both roles, but ownership is checked inside the
  service. Administrator-only application management uses `/api/admin/applications`.
