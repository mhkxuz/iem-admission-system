# Academic Project Report

## IEM Online Admission System — A MEAN Stack Admission Portal

**Project type:** Software Engineering Lab assignment  
**Architecture:** MongoDB, Express.js, Angular, Node.js  
**Academic session modelled:** 2026–2027  
**Status:** Stages 1–8 implemented and tested; Stage 9 documentation completed

---

## 1. Introduction

Admission processing is a workflow-intensive activity. Applicants provide personal details, academic
history, entrance-examination information and supporting documents. Administrators must verify those
details, apply consistent eligibility decisions, communicate outcomes and retain an audit trail of
who changed what and when.

The IEM Online Admission System is a web-based proof of concept that digitises this workflow using
the MEAN Stack. It provides a single-page Angular client, an Express REST API, Mongoose data models
and a MongoDB database. Authentication is stateless and token-based, authorisation is role-aware, and
document uploads are validated before storage.

The project deliberately focuses on the complete request-response path rather than isolated UI
screens. Each important action — registration, application submission, document upload, status
change or dashboard query — travels from the browser through Express middleware and services to
MongoDB, then back to the UI. Automated tests exercise those paths with real HTTP requests and real
database operations where practical.

This report describes the problem, design, implementation, testing evidence, design decisions and
limitations of the completed proof of concept.

## 2. Problem statement

A manual or spreadsheet-driven admission process has several weaknesses:

- Applicants must repeatedly provide the same information and follow up manually for status.
- Document collection is fragmented and difficult to associate securely with the correct applicant.
- Administrators lack a consistent, enforceable process for moving applications through review.
- There is no reliable record of who changed an application status, when, or why.
- Summary reporting requires manual counting and is prone to error.
- Access control is difficult to enforce when files and records are shared informally.

The problem addressed by this project is therefore to build a small but complete admission portal
that:

1. Lets applicants submit structured applications and supporting documents.
2. Prevents applicants from reading or modifying another applicant's records.
3. Gives administrators controlled review and decision tools.
4. Enforces a defined status workflow and records an audit trail.
5. Produces accurate dashboard statistics directly from the database.
6. Demonstrates secure authentication, validation, error handling and testing practices.

## 3. Objectives

The project objectives are:

- Implement applicant registration, login and profile retrieval with JWT authentication.
- Hash passwords with bcrypt and prevent password exposure in API responses.
- Enforce applicant and administrator roles on both the frontend and backend.
- Allow one admission application per applicant per academic session.
- Store structured personal, academic and admission-choice information.
- Validate all application sections on the server and reject invalid data.
- Support PDF/JPEG/PNG document uploads with extension, MIME and magic-byte checks.
- Keep file content on disk and document metadata in MongoDB.
- Restrict document viewing and downloading to the owner or an administrator.
- Provide administrator search, filters, sorting, pagination and detailed inspection.
- Enforce a strict status state machine with terminal states.
- Record chronological audit history for submission and every successful transition.
- Compute dashboard statistics using MongoDB aggregation pipelines.
- Verify the system with automated backend and frontend tests, a production build and an HTTP smoke
  test.
- Document the implementation, schema, API, demonstration flow and submission process.

## 4. Scope of the POC

### Included

- Applicant self-registration and login.
- Administrator provisioning through a seed script.
- One application per applicant per academic session.
- Personal, academic and admission-choice sections.
- Academic document upload, listing, inline viewing and download.
- Role-based access control and ownership checks.
- Administrator application listing with search, department/category/status filters, sorting and
  pagination.
- Application detail inspection with documents and audit history.
- Status transitions: `Submitted → Under Review → Selected` or `Rejected`.
- Dashboard totals and status, department and category distributions using aggregation.
- Responsive Angular layouts, loading states, empty states and error states.
- Backend, frontend, integration and replica-set test coverage.

### Deliberately excluded

- Real payment processing.
- Email/SMS verification, notifications or password reset.
- Multiple applications or multi-session history in the UI.
- Document-specific verification checklists.
- External object storage, virus scanning or CDN delivery.
- Production deployment automation, monitoring or backup strategy.
- Real-browser automation.

The scope is intentionally bounded so that the full lifecycle can be implemented, explained and
demonstrated within a lab project.

## 5. MEAN Stack architecture

The system has three runtime layers:

```text
┌──────────────────────────────────────────────┐
│ Angular 22 SPA — http://localhost:4200       │
│ Standalone components, reactive forms,       │
│ route guards, HTTP interceptor               │
└──────────────────────┬───────────────────────┘
                       │ JSON / multipart HTTP
                       │ Authorization: Bearer <JWT>
┌──────────────────────▼───────────────────────┐
│ Express 4 REST API — http://localhost:5000   │
│ Routes → middleware → controllers → services │
│ JWT auth, RBAC, validation, upload handling  │
└──────────────────────┬───────────────────────┘
                       │ Mongoose ODM
┌──────────────────────▼───────────────────────┐
│ MongoDB                                       │
│ users, applications, uploadeddocuments,       │
│ applicationstatushistories                    │
│                                               │
│ Disk: backend/uploads/documents               │
└───────────────────────────────────────────────┘
```

### MongoDB

Stores users, applications, document metadata and audit history. The application document embeds
bounded admission details while referencing users, documents and history entries. Aggregation
pipelines compute dashboard statistics.

### Express and Node.js

Express exposes REST routes, applies authentication and role middleware, validates payloads, handles
multipart uploads and centralises errors. Controllers stay thin; business rules live in services.

### Angular

The Angular client provides the applicant and administrator interfaces. Route guards prevent
unauthorised navigation, the HTTP interceptor attaches the JWT, reactive forms provide immediate
validation, and services encapsulate API calls.

### Cross-cutting configuration

- CORS allows the configured Angular origin.
- JSON and URL-encoded bodies are limited to 10 MB.
- Multer limits document files to 5 MB by default.
- Environment variables control the port, database URI, JWT secret/lifetime, upload directory, size
  limit, CORS origin and administrator seed values.

## 6. System modules

| Module | Responsibility | Main files |
| --- | --- | --- |
| Authentication | Registration, login, profile, JWT generation | `auth.controller.js`, `auth.service.js`, `auth.validator.js` |
| Authorisation | Bearer-token verification and role enforcement | `auth.middleware.js`, `role.middleware.js` |
| Applications | Submission, duplicate prevention, owner/admin retrieval | `application.controller.js`, `application.service.js`, `application.validator.js` |
| Documents | Upload, metadata, secure view/download, listing | `document.controller.js`, `document.service.js`, `upload.middleware.js` |
| Administration | Listing, search, filters, details, status changes | `admin.controller.js`, `admin.service.js` |
| Workflow | State machine and allowed transitions | `status-workflow.service.js` |
| Statistics | Aggregation pipelines and result shaping | `dashboard-statistics.service.js` |
| Identity generation | Unique application IDs | `id-generator.js` |
| Error handling | Centralised response mapping and safe 500s | `error.middleware.js`, `app-error.js`, `api-response.js` |
| Applicant UI | Dashboard, application form, uploads, status timeline | `features/applicant/*` |
| Administrator UI | Statistics, filters, listing, detail panel, status controls | `features/admin/dashboard/*` |
| Shared UI | Branding and role-aware navigation | `shared/components/navbar/*` |

## 7. Database design

The full field-level schema is in [SCHEMA.md](SCHEMA.md). The design uses four collections.

### User

Stores identity, role and profile fields. Email is unique. The password is excluded from normal
queries and serialised output, and a pre-save hook hashes it with bcrypt.

### Application

Stores the generated application ID, applicant reference, academic session, embedded personal,
academic and admission-choice sections, status and submission time.

Two relationships are exposed as Mongoose virtuals:

- `documents` → `UploadedDocument.application`
- `statusHistory` → `ApplicationStatusHistory.application`

A compound unique index on `{ applicant, academicSession }` enforces one application per applicant
per session. A unique index on `applicationId` protects generated IDs.

### UploadedDocument

Stores application and applicant references, document type, original and stored filenames, relative
path, verified MIME type, size and timestamps. The binary is not stored in MongoDB.

### ApplicationStatusHistory

Stores application reference, previous status, new status, actor (`changedBy`), remarks and timestamp.
The initial submission is recorded as `Submitted → Submitted`; later rows represent administrator
transitions.

### Design rationale

Embedding `personalInfo`, `academicInfo` and `admissionInfo` gives a single-document read for the
common application view. These sections are bounded, owned by one application and always read
together. References are used for users, files and audit entries because those entities have
independent lifecycles and potentially growing histories. This avoids unbounded arrays and keeps
document access and audit queries simple.

## 8. Request-response lifecycle

A representative protected request is an administrator loading an application list.

1. The administrator signs in through `POST /api/auth/login`.
2. The Express auth service loads the user with `+password`, compares the bcrypt hash and signs a JWT
   containing user ID, role and email.
3. Angular stores the token and user data in `localStorage`; the interceptor attaches
   `Authorization: Bearer <token>` to subsequent API calls.
4. The request reaches `/api/admin/applications`.
5. `authenticate` verifies the JWT, reloads the user from MongoDB and attaches `req.user` and
   `req.userId`. A missing or invalid token returns `401`.
6. `requireAdmin` checks the loaded role. A non-admin receives `403`.
7. The controller passes query parameters to the admin service.
8. The service builds a MongoDB filter, escapes search text, validates sort fields, clamps pagination
   values and runs `countDocuments` and `find` concurrently.
9. MongoDB returns the matching documents; referenced applicant summaries are populated.
10. The controller wraps the result in the standard success envelope with pagination metadata.
11. Angular renders the table, loading state, empty state or error state.
12. If anything unexpected fails, the central error middleware returns a safe response without
    exposing internals; a `500` uses the generic message `Internal Server Error`.

A document request follows the same path but adds Multer/magic-byte validation on upload, or an
ownership/path-traversal check on view/download.

## 9. Authentication and RBAC

### Registration

The public registration validator accepts only `fullName`, `email`, `password` and optional `phone`.
It overwrites `role` with `applicant`, normalises the email and rejects malformed input. The service
rejects duplicate emails with `409`.

### Login

Login returns a generic `Invalid email or password` for both unknown email and incorrect password,
reducing user enumeration. A successful login returns a signed JWT and a sanitised user object.

### Token handling

JWT payload:

```json
{
  "id": "<userObjectId>",
  "role": "applicant",
  "email": "user@example.com"
}
```

The token is signed with `JWT_SECRET` and expires after `JWT_EXPIRES_IN` (default `7d`). On every
protected request the backend:

1. Reads the Bearer token.
2. Verifies the signature and expiry.
3. Reloads the user from MongoDB.
4. Rejects deleted users.
5. Attaches the current user and ID to the request.

Reloading the user prevents a role change or account deletion from being ignored until token expiry.

### Role enforcement

`requireRole(...roles)` is a middleware factory. `requireAdmin` and `requireApplicant` are
specialisations. The administrator router applies authentication and admin authorisation to every
route. Applicant submission and upload routes use the applicant guard.

Frontend guards improve navigation but are not trusted as the security boundary. The server checks
roles and ownership on every relevant endpoint.

### Object-level authorisation

- Applicants may retrieve only their own application through `/api/applications/:id`.
- Applicants may list or access documents only when the document or application belongs to them.
- Administrators may inspect any application or document.
- Client-supplied identity fields are ignored during submission and status updates.

## 10. Document upload and security

### Upload pipeline

1. Angular builds `FormData` with `applicationId`, `documentType` and the file.
2. Multer writes the file to the configured upload directory with a randomized name.
3. The file filter checks the extension and declared MIME type.
4. The middleware reads the first bytes of the stored file and verifies the PDF, JPEG or PNG magic
   signature.
5. The service checks the application exists and belongs to the authenticated applicant.
6. Metadata is inserted into MongoDB.
7. Any failure after the file is written triggers cleanup of the orphaned file.

### Storage decision

MongoDB GridFS would be appropriate for very large or highly distributed binaries, but this POC
keeps file content on local disk and metadata in MongoDB. This makes streaming, HTTP content headers,
access checks and cleanup straightforward, and keeps database documents small. The trade-off is that
the deployment is tied to local storage and needs an external backup/object-storage strategy in
production.

### Retrieval security

- View and download require a valid JWT.
- Applicant ownership is checked against the document's `applicant` field.
- Administrators bypass the ownership restriction but still require authentication.
- The absolute file path is resolved against the upload root and checked with `path.relative` to
  prevent traversal.
- The original filename is sanitised before being placed in `Content-Disposition`.
- Inline responses set `X-Content-Type-Options: nosniff` and
  `Content-Security-Policy: default-src 'none'`.

## 11. Application status workflow

The workflow is centralised in `status-workflow.service.js`:

```text
Submitted ──> Under Review ──> Selected
                           └─> Rejected
```

Rules:

- Only `Submitted → Under Review` is allowed from the initial state.
- Only `Under Review → Selected` or `Under Review → Rejected` is allowed next.
- `Selected` and `Rejected` are terminal.
- Unknown statuses and skipped/backward transitions return `400`.

### Audit history

Each successful transition inserts an `ApplicationStatusHistory` row with:

- application reference,
- previous status read from the database,
- requested new status,
- administrator ID from the JWT,
- optional remarks,
- timestamp.

The initial submission creates a `Submitted → Submitted` row. The administrator detail response
returns history oldest-first and includes `allowedNextStatuses` for the UI.

### Concurrency and consistency

The server supports two deployment modes:

- **Replica set / sharded cluster:** status update and audit insertion run in a MongoDB transaction.
- **Standalone MongoDB:** an audit row is inserted first, then an atomic conditional update checks
  that the status is still the expected previous status. If another administrator won the race, the
  audit row is removed and the request returns `409`.

This keeps status and history consistent without requiring transactions on every development
instance.

## 12. MongoDB aggregation pipelines

Dashboard statistics are calculated in `dashboard-statistics.service.js` using four pipelines:

### Total applications

```js
[
  { $match: {} },
  { $group: { _id: null, count: { $sum: 1 } } }
]
```

### Status distribution

```js
[
  { $match: { status: { $in: ['Submitted', 'Under Review', 'Selected', 'Rejected'] } } },
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]
```

### Department distribution

```js
[
  { $match: { 'admissionInfo.preferredDepartment': { $type: 'string' } } },
  { $group: { _id: '$admissionInfo.preferredDepartment', count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } }
]
```

### Category distribution

```js
[
  { $match: { 'admissionInfo.admissionCategory': { $type: 'string' } } },
  { $group: { _id: '$admissionInfo.admissionCategory', count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } }
]
```

The status result is mapped onto the canonical workflow order with explicit zero counts. The
dashboard endpoint additionally returns the five most recent applications. Running the pipelines
concurrently with `Promise.all` reduces latency compared with four sequential queries.

## 13. Testing methodology

Testing used multiple layers.

### Backend

- Jest with Supertest for real HTTP requests against the Express app.
- `mongodb-memory-server` for isolated MongoDB instances.
- `MongoMemoryReplSet` for transaction and concurrent-update tests.
- Supertest requests for authentication, RBAC, validation, CRUD, upload, workflow and aggregation.
- Database assertions after HTTP calls to verify persisted state, indexes and audit entries.
- Mocked failure injection for unexpected `500` responses and audit-insert rollback.
- Temporary file tracking and cleanup for upload tests.

### Frontend

- Angular CLI with Vitest and jsdom.
- TestBed component/service tests.
- Mocked HTTP services and router/navigation.
- Coverage of guards, interceptor, auth service, document service, login, registration, navbar,
  applicant dashboard, application form, admin listing and dashboard aggregation/error states.

### Real-application check

- A persistent standalone MongoDB instance was started on an isolated database.
- The backend ran on a dedicated port with an isolated upload directory.
- A Node HTTP script exercised health, registration, login, submission, upload, retrieval, security,
  administration, status changes and dashboard statistics.
- The backend was stopped and restarted, then the same applicant and administrator data, file,
  history and aggregation results were verified.
- The isolated database and upload directory were removed afterward; existing data was not touched.

### Explicit limits

- No real-browser automation (for example Playwright or Cypress) was performed.
- Replica-set transactions were tested with an in-memory replica set, not a persistent production
  replica set.
- The persistent smoke test covered one applicant and one administrator. Broader concurrency is
  covered by automated tests.

## 14. Results

### Automated suites

| Suite | Result |
| --- | --- |
| Backend Jest suites | 9 passed |
| Backend tests | 129 passed |
| Frontend test files | 14 passed |
| Frontend tests | 57 passed |
| Angular production build | Success, no warnings |
| Replica-set transaction tests | 3 passed |
| Persistent HTTP smoke assertions | 57 passed |

The initial Angular bundle in the Stage 8 build was approximately `301.55 kB` raw / `81.60 kB`
estimated transfer.

### Functional results verified

- Registration, login, logout/re-login and profile retrieval.
- Password hashing and non-exposure.
- Forced applicant role and duplicate-email rejection.
- Application submission, generated ID, initial audit history and duplicate prevention.
- Document upload, listing, inline view and download.
- Applicant isolation and administrator-only access.
- Administrator dashboard statistics, search, filters, sorting and pagination.
- Detailed application and document inspection.
- `Submitted → Under Review → Selected` transitions, terminal-state rejection and audit history.
- Applicant visibility of the updated status.
- Persistence across a backend restart.
- Concurrent administrator update protection.
- Safe handling of unexpected server errors.

### Security findings fixed in Stage 8

- Unexpected `500` responses could expose raw exception messages; they now return
  `Internal Server Error`.
- A failed initial audit insert could leave an application without submission history; submission now
  deletes the new application before returning the error.
- The login screen exposed seeded administrator credentials; the hint was removed.
- Administrator application-list and applicant document-list errors were silent; both now show an
  error and retry action.

## 15. Design decisions

### Why MEAN?

A single language (JavaScript/TypeScript) across client and server reduces context switching. JSON is
used end to end, Angular provides a structured SPA, Express keeps the API lightweight, and MongoDB
fits hierarchical admission data and aggregation reporting.

### Why MongoDB?

Admission applications contain nested personal, academic and admission sections. A document model
stores these naturally and allows the API to retrieve a complete application with one read. Unique
indexes still enforce identity constraints, and aggregation pipelines compute summary statistics
without application-side counting loops.

### Embedded sections plus references

Bounded sections that are always read together are embedded. Entities with independent lifecycle,
growing history or external file content are referenced. This hybrid avoids both excessive joins and
unbounded arrays.

### Stateless JWT authentication

JWTs avoid server-side session storage and work naturally with a separate Angular origin. The
trade-off is that revocation requires expiry or an additional denylist/refresh-token mechanism, which
is outside this POC.

### Server-authoritative workflow

Status transitions, identity fields and audit actors are server-derived. The client can request a
transition but cannot set the previous status, actor or applicant. This prevents privilege and data
tampering.

### Disk storage for files

Local disk keeps the POC simple and demonstrates secure streaming and cleanup. It is not a production
object-storage strategy.

### Aggregation in MongoDB

Dashboard figures must reflect the database state. Running `$match`/`$group` pipelines in MongoDB is
more efficient and more accurate than loading all applications into Node.js, and it demonstrates a
key NoSQL capability.

### Progressive test layers

Unit/component tests catch UI logic errors; HTTP integration tests catch middleware and service
errors; replica-set tests catch transaction/concurrency problems; the persistent smoke test verifies
real startup and restart behaviour. No single layer is treated as sufficient.

## 16. Limitations

- Academic POC; not production-ready.
- No real-browser automation was performed.
- Replica-set testing used an in-memory replica set.
- JWT in `localStorage` is exposed to XSS; no refresh rotation or revocation list exists.
- No email verification, password reset, MFA, rate limiting or account lockout.
- Documents are stored on a single local disk with no antivirus scan, backup, lifecycle policy or
  CDN.
- One application per applicant per session; the UI does not present a multi-session history.
- No separate per-document verification status.
- No production deployment, monitoring, centralised logging or secret manager.
- Local MongoDB helper depends on a `mongod` binary being available at a known path.
- Index creation relies on Mongoose defaults; production should manage indexes explicitly.
- The seed script supports environment-provided administrator credentials; strong values must be
  configured for any non-demo environment.

## 17. Future improvements

- Add email verification, password reset and optional MFA.
- Move refresh tokens to secure HTTP-only cookies and add revocation.
- Add rate limiting, Helmet-style security headers and audit logging.
- Store documents in S3-compatible object storage with encryption, virus scanning and signed URLs.
- Add per-document verification states and administrator remarks.
- Add notification emails/SMS for status changes.
- Add bulk export, CSV/PDF reports and scheduled statistics.
- Introduce role granularity (reviewer, admissions officer, super-admin).
- Add real-browser end-to-end tests with Playwright or Cypress.
- Run integration tests against a persistent replica set in CI.
- Add API documentation generation and contract tests.
- Containerise the stack and add CI/CD, backups and monitoring.

## 18. Conclusion

The IEM Online Admission System demonstrates a complete, coherent MEAN Stack admission workflow. It
combines a structured Angular client with a layered Express API and a MongoDB schema that balances
embedded admission data with referenced users, documents and audit history.

The project enforces authentication, RBAC and ownership; validates application data and uploads;
prevents duplicate submissions; restricts status transitions; preserves audit history; and computes
dashboard statistics with aggregation pipelines. It also includes substantial automated coverage and
an isolated persistent smoke test.

The result is an academic proof of concept that is functional, explainable and demonstrable. It is
not a production system: security hardening, scalable file storage, operational monitoring and
real-browser automation remain future work. Within the intended lab scope, however, it satisfies the
stated objectives and provides a solid basis for demonstration and viva discussion.
