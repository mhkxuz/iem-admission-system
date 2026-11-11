# Design Choices and Improvements in a MEAN Stack Admission System

## Introduction

The IEM Online Admission System is a MEAN Stack proof of concept for applicant registration,
admission application submission, academic document upload, administrative review and status
tracking. The system uses MongoDB for persistence, Express and Node.js for the REST API, Angular for
the client and JWT/bcrypt for authentication. The assignment required a working application and a
short discussion of design choices and possible improvements; this document is that concise
write-up. A more detailed technical report is available in `PROJECT_REPORT.md`.

## Why the MEAN Stack?

Using JavaScript and TypeScript across the stack reduces context switching and keeps data in JSON
form from the Angular client through Express to MongoDB. Angular provides a structured standalone
component architecture, reactive forms, route guards and an HTTP interceptor. Express is lightweight
and makes the middleware pipeline explicit. MongoDB suits admission data because personal, academic
and admission-choice information is naturally hierarchical, while aggregation pipelines provide
dashboard statistics without loading the whole collection into Node.js.

## Key design choices

### Hybrid document model

The application document embeds `personalInfo`, `academicInfo` and `admissionInfo`. These sections
are bounded, always read together and owned by one application, so embedding gives an efficient
single-document read. Users, uploaded documents and status-history entries are separate collections
referenced by ObjectId. They have independent lifecycles, and audit history can grow over time.
Keeping them separate avoids unbounded arrays and supports ownership checks and chronological audit
queries. A compound unique index on `{ applicant, academicSession }` enforces one application per
session, while a unique index protects generated application IDs.

### Stateless authentication and layered authorisation

Registration always creates an applicant; a client cannot self-assign the administrator role. Login
returns a signed JWT, and Angular attaches it through an HTTP interceptor. The backend verifies the
token and reloads the user from MongoDB on every protected request, so a deleted account or changed
role is not trusted indefinitely. Middleware enforces roles, and services enforce object ownership.
Frontend guards improve navigation but are not treated as the security boundary. Passwords are
hashed with bcrypt, excluded from queries by default and stripped from serialised responses.

### Server-authoritative submission and workflow

The server derives the applicant, application ID, submission timestamp, status and audit actor.
Client-supplied privilege fields are ignored. The status workflow is a centralised state machine:
`Submitted → Under Review → Selected` or `Rejected`, with `Selected` and `Rejected` terminal.
Invalid transitions return HTTP 400. Every successful change creates an audit row, including the
initial `Submitted → Submitted` entry. On replica sets the status update and history insert use a
transaction. On standalone MongoDB, a compensating sequence writes history first, performs an atomic
conditional update, and removes the history row if it loses a concurrency race. This preserves the
invariant that a status cannot change without a matching audit record.

### Upload security and storage

Multer writes files with randomised names. The backend checks allowed extensions, declared MIME
types and actual file magic bytes, so a renamed text or executable file cannot pass as a PDF. The
service verifies that the application belongs to the applicant. View and download endpoints require
authentication and ownership, resolve paths against the upload root to prevent traversal, sanitise
response filenames and set `nosniff` and restrictive content-security headers. Failed uploads are
removed from disk. File content stays on local disk while metadata stays in MongoDB; this keeps the
database small and makes streaming simple, though production would need object storage, backups and
virus scanning.

### MongoDB aggregation for statistics

Dashboard totals and status, department and category distributions are produced by `$match` and
`$group` pipelines. Status buckets are returned in workflow order with explicit zero counts. This is
more efficient and accurate than loading applications into Node.js to count them, and it demonstrates
a core MongoDB capability.

### Testing strategy

Testing is layered. Jest and Supertest exercise real HTTP routes against an in-memory MongoDB;
`MongoMemoryReplSet` verifies transactions and concurrent administrator updates; failure injection
checks safe 500 responses and audit rollback. Angular tests cover guards, the interceptor, auth and
document services, login, registration, the applicant dashboard and form, admin listing/filtering and
dashboard aggregation/error states. Stage 8 reported 9 backend suites and 129 passing tests, 14
frontend files and 57 passing tests, and a successful production build. A persistent standalone
MongoDB smoke test ran 57 HTTP assertions, then restarted the backend and verified that application
data, the stored document, audit history and aggregation results persisted. The isolated database was
removed afterward.

## Improvements already applied

Earlier stages established the core application. The final quality-assurance stage fixed several
issues found during review: unexpected 500 responses no longer expose raw exception messages;
submission now rolls back a newly created application if the initial audit row fails; the login screen
no longer displays seeded administrator credentials; and administrator application-list and applicant
document-list failures now show explicit error and retry states instead of appearing as empty data.
Document retry also handles a missing application ID safely.

## Limitations and future work

This is an academic proof of concept, not a production system. Real-browser automation was not
performed, and replica-set transactions were verified with an in-memory replica set rather than a
persistent production cluster. JWTs are stored in `localStorage`, which is convenient but exposed to
XSS; a production design should use secure HTTP-only refresh tokens and revocation. The system also
lacks email verification, password reset, MFA, rate limiting, account lockout, antivirus scanning and
centralised monitoring. Documents are stored on a single local disk, and one application per session
is modelled without a multi-session UI.

Future improvements include secure refresh-token handling, object storage with encryption and
malware scanning, per-document verification states, notification services, role granularity,
Playwright end-to-end tests, persistent replica-set integration tests, containerisation and CI/CD.
These changes would move the project from a well-tested academic POC toward a deployable admission
platform.

## Conclusion

The project meets its core objectives: it implements a complete applicant and administrator
workflow, enforces authentication, RBAC and ownership, validates data and uploads, prevents duplicate
applications, restricts status transitions, preserves audit history and computes dashboard
statistics with MongoDB aggregation. The design prioritises clear separation of concerns, server-side
authority and testable business rules. Within the assignment scope, it provides a coherent
demonstration of MEAN Stack development and a sound foundation for further improvement.
