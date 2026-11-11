# IEM Online Admission System

A MEAN Stack proof-of-concept for an institute admission portal. Applicants can register, sign in,
submit an admission application, upload academic documents and track application status.
Administrators can inspect applications, search and filter them, review uploaded documents, move
applications through a controlled status workflow and view MongoDB aggregation-based dashboard
statistics.

The project was developed for the Software Engineering Lab assignment and is an academic POC, not a
production deployment.

## Documentation

- [API reference](docs/API.md)
- [Database schema](docs/SCHEMA.md)
- [Detailed project report](docs/PROJECT_REPORT.md)
- [Concise assignment write-up](docs/WRITEUP.md)
- [Demonstration guide and viva questions](docs/DEMO_GUIDE.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)

## 1. Problem statement

Manual admission processing is slow, error-prone and difficult to audit. Applicants must submit
personal and academic details, attach supporting documents and repeatedly follow up to learn their
status. Administrators need a single place to review applications, verify documents, apply consistent
status rules and produce summary statistics.

This project implements a small web-based admission workflow that addresses those needs while
remaining simple enough to demonstrate the core MEAN Stack concepts: REST APIs, JWT authentication,
role-based authorization, document uploads, MongoDB references, audit history and aggregation
pipelines.

## 2. Objectives

- Provide secure applicant registration and login.
- Enforce applicant and administrator roles with JWT and RBAC.
- Allow an applicant to submit one admission application per academic session.
- Store structured personal, academic and admission-choice information.
- Validate submitted data on both the client and the server.
- Accept academic documents with file-type and file-signature checks.
- Store document metadata in MongoDB and file content on disk.
- Restrict document access to the owner or an administrator.
- Provide administrators with search, filters, sorting and pagination.
- Enforce a strict status workflow with immutable audit history.
- Produce dashboard statistics with MongoDB aggregation pipelines.
- Demonstrate repeatable automated testing and a production Angular build.

## 3. MEAN Stack architecture

The application is split into two independently running applications:

```text
Angular SPA (http://localhost:4200)
        |
        | HTTP/JSON and multipart/form-data
        v
Express REST API (http://localhost:5000)
        |
        | Mongoose ODM
        v
MongoDB (mongodb://127.0.0.1:27017/iem_admission_db)
        |
        +-- users
        +-- applications
        +-- uploadeddocuments
        +-- applicationstatushistories
        +-- backend/uploads/documents (file content on disk)
```

The Angular frontend stores the JWT in `localStorage` and attaches it as a Bearer token through an
HTTP interceptor. The Express backend verifies the token, loads the current user from MongoDB, applies
role and ownership checks, and delegates business rules to services. Document binaries remain outside
MongoDB in the configured upload directory.

## 4. Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Database | MongoDB 7.0.x | Persistent document storage |
| ODM | Mongoose 8.x | Schemas, validation, references and aggregation |
| Backend runtime | Node.js | Server runtime |
| Backend framework | Express 4.x | REST routes, middleware and error handling |
| Authentication | `jsonwebtoken` 9.x | Signed JWT access tokens |
| Password hashing | `bcryptjs` 2.x | Salted bcrypt password hashes |
| Uploads | Multer 1.4 LTS | Multipart file handling and disk storage |
| Frontend | Angular 22 | Standalone components, routing, reactive forms |
| Language | TypeScript 6.0.x | Typed frontend code |
| Frontend tests | Vitest 5 via Angular CLI | Component, service, guard and interceptor tests |
| Backend tests | Jest 29 + Supertest | API and integration tests |

## 5. Project directory structure

```text
mean-admission-system/
├── package.json                 # Root convenience scripts
├── .gitignore
├── README.md
├── docs/
│   ├── API.md
│   ├── SCHEMA.md
│   ├── PROJECT_REPORT.md
│   ├── WRITEUP.md
│   ├── DEMO_GUIDE.md
│   ├── SUBMISSION_CHECKLIST.md
│   ├── STAGE6_STATUS_WORKFLOW.md
│   ├── STAGE7_AGGREGATION_PIPELINES.md
│   └── STAGE8_TESTING_QA.md
├── backend/
│   ├── app.js                   # Express app and route registration
│   ├── server.js                # Startup and graceful shutdown
│   ├── config/
│   │   ├── config.js            # Environment configuration
│   │   └── db.js                # Persistent DB / test DB connection
│   ├── controllers/             # Auth, application, document, admin handlers
│   ├── middleware/              # Auth, RBAC, upload and error middleware
│   ├── models/                  # User, Application, Document, StatusHistory
│   ├── routes/                  # /api/auth, /api/applications, /api/documents, /api/admin
│   ├── services/                # Business logic, workflow, aggregation
│   ├── validators/              # Request validation and sanitisation
│   ├── utils/                   # API response, AppError, ID generation
│   ├── scripts/
│   │   ├── seed-admin.js        # Administrator provisioning
│   │   └── start-db.js          # Local persistent MongoDB helper
│   ├── tests/                   # Jest/Supertest suites
│   ├── uploads/documents/       # Uploaded files (ignored by Git)
│   ├── data/db/                 # Local persistent MongoDB data (ignored)
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── angular.json
    ├── package.json
    └── src/
        ├── styles.css
        └── app/
            ├── app.config.ts
            ├── app.routes.ts
            ├── core/
            │   ├── guards/
            │   ├── interceptors/
            │   ├── models/
            │   └── services/
            ├── features/
            │   ├── auth/login/
            │   ├── auth/register/
            │   ├── applicant/dashboard/
            │   ├── applicant/application-form/
            │   └── admin/dashboard/
            └── shared/components/navbar/
```

`node_modules/`, `.env`, production builds, uploaded content, local database files and test coverage
outputs are excluded by `.gitignore`.

## 6. Prerequisites

- Node.js and npm. The project was verified with Node.js 26.13.0. Use a current LTS release supported
  by Angular 22.
- MongoDB 7.x. The verified local binary was MongoDB 7.0.24. Alternatively, point
  `MONGODB_URI` at an existing MongoDB instance.
- A modern browser for manual demonstration.
- No global Angular CLI installation is required; the project uses the local CLI through `npx`/npm
  scripts.

## 7. Installation

From the project root:

```bash
cd mean-admission-system

cd backend
npm install

cd ../frontend
npm install
```

The backend and frontend have separate `package.json` files and separate `node_modules` directories.

## 8. MongoDB setup

### Option A: use the project helper

```bash
# From the project root
npm run db:start

# Equivalent
cd backend
npm run db:start
```

The helper looks for a `mongod` binary in common locations (including the `mongodb-memory-server`
binary cache used in this environment), then starts it on `127.0.0.1:27017` with its data directory
at `backend/data/db`. Keep that terminal open. Press `Ctrl+C` to stop MongoDB gracefully.

### Option B: use an existing MongoDB service

Start MongoDB using your system service or container, then set `MONGODB_URI` in `backend/.env`.
For example:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/iem_admission_db
```

The configured database is `iem_admission_db` by default. Development and production modes connect
only to the persistent URI. Automated backend tests use `mongodb-memory-server`; the smoke test in
Stage 8 used an isolated database and did not modify existing data.

## 9. Environment configuration

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env`. The tracked `.env.example` contains placeholders only; real secrets must
stay in the ignored `.env`.

| Variable | Default / example | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | Express HTTP port |
| `NODE_ENV` | `development` | `test` switches to an in-memory MongoDB for Jest |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/iem_admission_db` | Persistent MongoDB connection |
| `JWT_SECRET` | placeholder | JWT signing secret; replace with a long random value |
| `JWT_EXPIRES_IN` | `7d` | JWT lifetime |
| `UPLOAD_DIR` | `./uploads/documents` | Upload directory relative to `backend/` |
| `MAX_FILE_SIZE_BYTES` | `5242880` | Maximum upload size (5 MB) |
| `CORS_ORIGIN` | `http://localhost:4200` | Allowed Angular origin |
| `ADMIN_EMAIL` | placeholder | Email used by the seed script |
| `ADMIN_PASSWORD` | placeholder | Password used by the seed script |
| `ADMIN_NAME` | `IEM Admissions Administrator` | Administrator display name |
| `ADMIN_PHONE` | `9876543200` | Administrator phone number |

`ADMIN_*` variables are read only when the administrator seed script runs. Do not commit `.env` or
real credentials.

## 10. Administrator seeding

Set private administrator values in `backend/.env`, then run:

```bash
# From the project root
npm run seed:admin

# Equivalent
cd backend
node scripts/seed-admin.js
```

The script:

- Connects to the configured persistent MongoDB.
- Creates the administrator if the email does not exist.
- Promotes an existing user to the `admin` role if the email already exists with another role.
- Hashes the password through the normal `User` model pre-save hook.

Use the email and password you configured in `.env` to sign in at `/auth/login`. There is no public
administrator registration endpoint. For a real deployment, always supply strong values through the
environment rather than relying on development defaults.

## 11. Backend startup

```bash
# From the project root
npm run start:backend

# Development with nodemon
npm run dev:backend

# Equivalent direct commands
cd backend
npm start
```

Expected output:

```text
[Database] Connected to persistent MongoDB at: mongodb://127.0.0.1:27017/iem_admission_db
  Server listening on http://localhost:5000
  Health Check: http://localhost:5000/api/health
```

Health check:

```bash
curl http://localhost:5000/api/health
```

The endpoint returns `200` when MongoDB is connected and `503` when it is not.

## 12. Frontend startup

```bash
# From the project root
npm run start:frontend

# Equivalent
cd frontend
npm start
```

Open `http://localhost:4200`.

The Angular services currently call `http://localhost:5000/api/...` directly. Keep the backend on
port `5000`, or update the API constants in:

- `frontend/src/app/core/services/auth.service.ts`
- `frontend/src/app/core/services/application.service.ts`
- `frontend/src/app/core/services/document.service.ts`
- `frontend/src/app/core/services/admin.service.ts`

The backend CORS origin must match the Angular dev-server URL.

## 13. Testing

### Backend

```bash
cd backend
npm test
```

Jest runs in band with open-handle detection. Tests use `mongodb-memory-server` and do not touch the
persistent `iem_admission_db` database. The Stage 8 result was **9 suites and 129 passing tests**,
including integration and replica-set transaction suites.

### Frontend

```bash
cd frontend
npx ng test --watch=false
```

The Stage 8 result was **14 test files and 57 passing tests** covering auth, guards, the interceptor,
services, applicant submission/uploads, admin listing/filtering and dashboard states.

### Production build

```bash
cd frontend
npm run build
```

Stage 8 produced a successful build with no warnings. The initial bundle was approximately
`301.55 kB` raw / `81.60 kB` estimated transfer.

No real-browser automation was performed. UI behavior is covered by Angular tests and the production
build; the real-application check was an HTTP smoke test.

## 14. API overview

All normal API responses use:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

Paginated responses also include `meta`. Errors use `success: false` plus `message`, and may include
an `errors` array.

| Group | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Authentication | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Applications | `POST /api/applications`, `GET /api/applications/my-application`, `GET /api/applications/:id` |
| Documents | `POST /api/documents/upload`, `GET /api/documents/application/:applicationId`, `GET /api/documents/:id/view`, `GET /api/documents/:id/download` |
| Administrator | `GET /api/admin/applications`, `GET /api/admin/applications/:id`, `PATCH /api/admin/applications/:id/status` |
| Dashboard statistics | `GET /api/admin/dashboard` |

See [docs/API.md](docs/API.md) for methods, authentication, roles, request bodies, responses and
error codes.

## 15. Authentication and RBAC

- Registration is public and always creates an `applicant`. A client-supplied `role` is ignored.
- Login returns a signed JWT containing the user ID, role and email. The default lifetime is `7d`.
- The Angular interceptor sends `Authorization: Bearer <token>` on API requests.
- `authenticate` verifies the token and reloads the user from MongoDB on every request. A deleted user
  cannot keep using an old token.
- `requireAdmin` and `requireApplicant` enforce role access. Missing authentication returns `401`;
  an authenticated user with the wrong role receives `403`.
- Applicants can access only their own application and documents. Administrators can inspect all
  applications and documents.
- Passwords are hashed with bcrypt (cost 10) and excluded from queries by default
  (`select: false`). Model JSON/object transforms also remove the password field.

Frontend route guards mirror the server rules, but the backend remains the authority for every
authorization decision.

## 16. Document storage architecture

1. The browser sends multipart data to `POST /api/documents/upload`.
2. Multer writes the file to `UPLOAD_DIR` with a collision-resistant name:
   `doc_<timestamp>_<random-hex>.<extension>`.
3. The middleware checks the extension (`pdf`, `jpg`, `jpeg`, `png`), declared MIME type and file
   magic bytes. A renamed executable or text file with a PDF extension is rejected.
4. The service validates the document type, locates the application, and confirms that the applicant
   owns it.
5. Only metadata is stored in `uploadeddocuments`: application reference, applicant reference,
   document type, original name, stored name, relative path, verified MIME type, size and timestamps.
6. Viewing and downloading require authentication. Applicants may access only their own documents;
   administrators may access all documents.
7. The resolved absolute path is compared with the upload root to prevent path traversal. The
   original filename is sanitised before being used in response headers.
8. Failed uploads are unlinked from disk, including validation failures and database errors.

The default limit is 5 MB. Files are served with `X-Content-Type-Options: nosniff`; inline views also
set a restrictive `Content-Security-Policy`.

## 17. Application status workflow

The workflow is a strict state machine defined in
`backend/services/status-workflow.service.js`:

```text
Submitted ──> Under Review ──> Selected
                           └─> Rejected
```

`Selected` and `Rejected` are terminal. Requests that skip a step or leave a terminal state return
`400`.

Every successful change creates an `ApplicationStatusHistory` row containing the previous status, new
status, the administrator who made the change, optional remarks and a timestamp. The initial
submission also creates an audit row with `Submitted → Submitted`, so the complete lifecycle is
traceable.

On replica sets, the status update and audit insert run in one MongoDB transaction. On standalone
MongoDB, a compensating sequence writes the audit row first, performs an atomic conditional status
update, and removes the audit row if the update loses a concurrency race. This prevents a status
change without history and prevents duplicate successful histories when two administrators act at
the same time.

## 18. MongoDB aggregation explanation

Dashboard statistics are calculated by MongoDB, not by loading every application into Node.js:

- Total applications: `$match` followed by `$group` with `$sum: 1`.
- Status distribution: `$match` allowed statuses, `$group` by `$status`, `$sort` by status.
- Department distribution: `$match` string departments, `$group` by
  `$admissionInfo.preferredDepartment`, `$sort` by count descending.
- Category distribution: the same shape for `$admissionInfo.admissionCategory`.

The service maps grouped rows onto the canonical status order and inserts explicit zero counts. The
API returns:

```json
{
  "metrics": {
    "totalApplications": 0,
    "submitted": 0,
    "underReview": 0,
    "selected": 0,
    "rejected": 0
  },
  "statusDistribution": [],
  "departmentDistribution": [],
  "categoryDistribution": [],
  "recentApplications": []
}
```

`GET /api/admin/dashboard` also returns the five most recent applications.

## 19. Known limitations

- This is an academic POC and is not production-ready.
- JWT storage in `localStorage` is convenient for the demo but is exposed to XSS; a production system
  should consider secure, HTTP-only refresh-token patterns.
- There is no refresh-token rotation, token revocation list, email verification or password reset.
- There is no rate limiting, account lockout, CAPTCHA or centralised security-header middleware.
- Documents are stored on a single local disk, not object storage. There is no antivirus scanning,
  backup strategy, lifecycle policy or CDN.
- Administrators can inspect documents but the system does not implement a separate verification
  checklist per document.
- One application per applicant per academic session is enforced. There is no multi-session
  application history in the UI.
- Real-browser automation was not performed; UI coverage comes from Angular tests, the production
  build and an HTTP smoke test.
- Replica-set transactions were tested with an in-memory replica set
  (`MongoMemoryReplSet`), not a persistent production replica set.
- The local MongoDB helper depends on a `mongod` binary being available at one of its known paths.
- For real deployments, configure a strong `JWT_SECRET`, strong `ADMIN_*` values and a proper
  MongoDB deployment; do not rely on development defaults.

## 20. Academic context

This project demonstrates a complete MEAN request-response lifecycle, document-oriented data
modelling with embedded documents and references, stateless JWT authentication, middleware-based
authorization, secure file handling, a constrained workflow with audit history, aggregation
pipelines, automated backend/frontend testing and documentation for demonstration and submission.

See [docs/WRITEUP.md](docs/WRITEUP.md) for the concise assignment write-up and
[docs/PROJECT_REPORT.md](docs/PROJECT_REPORT.md) for the full technical report.
