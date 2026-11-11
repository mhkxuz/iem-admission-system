# Demonstration Guide and Viva Preparation

This guide prepares a complete, repeatable demonstration of the IEM Online Admission System. Run all
commands from the project root unless a step says otherwise.

## 1. Pre-demonstration checklist

- Node.js and npm are installed.
- Backend and frontend dependencies are installed.
- MongoDB is available on `127.0.0.1:27017`.
- `backend/.env` exists and contains a strong, private `JWT_SECRET`, the MongoDB URI and the
  administrator seed values.
- Ports `27017`, `5000` and `4200` are free.
- A small PDF or image file is available for upload (maximum 5 MB).
- The administrator email and password you configured are known to you. Do not display them in
  slides, screenshots or committed files.

First-time dependency installation:

```bash
cd backend
npm install

cd ../frontend
npm install
```

First-time environment setup:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and replace the placeholders. At minimum set:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/iem_admission_db
JWT_SECRET=<long-random-private-value>
ADMIN_EMAIL=<your-admin-email>
ADMIN_PASSWORD=<your-strong-admin-password>
ADMIN_NAME=<administrator-display-name>
```

## 2. Start MongoDB

Open **Terminal 1**:

```bash
cd /path/to/mean-admission-system
npm run db:start
```

This starts the local `mongod` binary on port `27017` with data under `backend/data/db`. Keep the
terminal open.

Alternative, if MongoDB is already installed as a system service, start that service instead and
confirm that `MONGODB_URI` points to it.

## 3. Seed the administrator

If the administrator account does not exist yet, open a new terminal:

```bash
cd /path/to/mean-admission-system
npm run seed:admin
```

The script reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` and `ADMIN_PHONE` from
`backend/.env`. It creates the admin or promotes an existing user with that email. It is safe to run
the script again: an existing admin is reported and left in place.

## 4. Start the Express backend

Open **Terminal 2**:

```bash
cd /path/to/mean-admission-system
npm run start:backend
```

Expected: database connection message and `Server listening on http://localhost:5000`.

Check health from any terminal:

```bash
curl http://localhost:5000/api/health
```

Expected: JSON with `"status": "healthy"` and `"database": "connected"`.

## 5. Start Angular

Open **Terminal 3**:

```bash
cd /path/to/mean-admission-system
npm run start:frontend
```

Open `http://localhost:4200` in a browser.

The Angular services call `http://localhost:5000/api/...`. Do not change the backend port for the
demo unless you also update those service URLs.

## 6. Demonstration sequence

### Step 1 — Show the landing page

Open `http://localhost:4200`.

Point out:

- IEM branding and session label.
- Guest navigation: Sign In and Register.
- The root route redirects to the applicant dashboard, but authentication guards redirect guests to
  login.

### Step 2 — Register an applicant

1. Click **Register**.
2. Enter a fresh full name, email, 10-digit phone number, password and matching confirmation.
3. Submit.

Explain that:

- The role is forced to `applicant` on the server.
- The password is bcrypt-hashed and never returned.
- Successful registration signs the applicant in and navigates to the applicant dashboard.

### Step 3 — Open the application form

Click **Application Form** or **Start Admission Application**.

Point out the prefilled name, email and phone from the account. Complete:

- Personal information and address.
- Class 10 and Class 12 board and percentages.
- Class 12 passing year and entrance examination details.
- Preferred department and admission category.

Submit the form.

Expected: redirect to the applicant dashboard with a generated application ID such as
`IEM-2026-12345`, status `Submitted`, an empty document list and the status timeline.

### Step 4 — Demonstrate validation and duplicate prevention

Optional quick checks:

- Try submitting the form with an invalid phone number, PIN code or percentage; show the inline
  validation messages.
- After a successful submission, open **Application Form** again. The UI shows that an application
  already exists and hides the form.
- Attempting a second submission through the API would return HTTP `409`.

### Step 5 — Upload academic documents

On the applicant dashboard:

1. Choose a document type, for example **Class 12 Marksheet**.
2. Select a PDF or JPEG/PNG file under 5 MB.
3. Click **Upload Document**.

Expected: success message and the document appears in the uploaded-documents table.

Point out:

- Randomised stored filename.
- Original filename shown as metadata.
- File-size formatting.
- View and download actions.

Optionally show that a file with an invalid extension or a renamed non-PDF is rejected.

### Step 6 — View and download the document

Click **View** to open the inline document stream, then **Download** to save it.

Explain that both requests require the applicant's JWT and ownership of the document.

### Step 7 — Sign out

Click **Sign Out** in the navbar.

Expected: token and cached user are removed from `localStorage`; the app returns to login.

### Step 8 — Sign in as administrator

Use the administrator email and password configured in `backend/.env`.

Expected: redirect to `/admin/dashboard` with full administrator navigation.

### Step 9 — Show dashboard statistics

Point out:

- Total applications.
- Submitted, Under Review, Selected and Rejected counts.
- Status distribution bars.
- Department and category distributions.
- Recent applications.

Explain that these figures are produced by MongoDB `$match`/`$group` aggregation pipelines, not by
loading all applications into Node.js.

### Step 10 — Search and filter applications

In the applications directory:

1. Search by the applicant's name.
2. Search by the generated application ID.
3. Apply a department filter.
4. Apply an admission-category filter.
5. Apply a status filter.
6. Change the sort order or sort column.
7. Change the page size if the dataset has enough records.
8. Click **Reset** to clear the filters.

Explain that filtering, search escaping, sorting and pagination happen on the server.

### Step 11 — Inspect the application

Click the application row or **Inspect**.

Show:

- Applicant identity and contact details.
- Personal, academic and admission sections.
- Uploaded documents.
- Current status and allowed next statuses.
- Audit timeline.

Use the admin **View** or **Download** action to open the applicant's document. This demonstrates that
administrators can access documents across applicants while applicants cannot.

### Step 12 — Move Submitted → Under Review

In the status panel:

1. Select **Under Review**.
2. Enter remarks such as `Academic documents verified.`
3. Apply the update.

Expected: status badge changes and a new audit entry appears with the administrator's identity and
remarks.

### Step 13 — Select or reject the application

From **Under Review**, choose either **Selected** or **Rejected**.

For a successful demo, choose **Selected** and add a remark such as `Merit listed.`

Expected:

- Status becomes `Selected`.
- No further transitions are offered because `Selected` is terminal.
- A second audit entry is added.

Optional: attempt an invalid transition through the API and show HTTP `400`, or use a second admin
session to demonstrate the `409` concurrency response.

### Step 14 — Show audit history

In the application detail panel, show the chronological entries:

1. Initial submission (`Submitted → Submitted`) by the applicant.
2. `Submitted → Under Review` by the administrator.
3. `Under Review → Selected` by the administrator.

Point out that the actor comes from the JWT, not from the client payload, and that the initial
submission history is created with the application.

### Step 15 — Show MongoDB aggregation results again

Return to the dashboard and show that the counts and distribution bars moved to reflect the status
change. Refresh the dashboard if necessary.

Explain the four pipelines and the explicit zero-count handling for statuses with no records.

### Step 16 — Sign back in as the applicant

1. Sign out of the administrator account.
2. Sign in with the applicant credentials.
3. Show the dashboard.

Expected:

- Application status is now `Selected` (or `Rejected`).
- The status timeline reflects the final state.
- The updated audit history is available to the applicant view.
- Uploaded documents are still listed and downloadable.

This closes the complete applicant → administrator → applicant lifecycle.

## 7. Useful commands for the demo

| Purpose | Command |
| --- | --- |
| Start local MongoDB | `npm run db:start` |
| Seed administrator | `npm run seed:admin` |
| Start backend | `npm run start:backend` |
| Start backend with nodemon | `npm run dev:backend` |
| Start frontend | `npm run start:frontend` |
| Build frontend | `npm run build:frontend` |
| Run backend tests | `npm run test:backend` |
| Run frontend tests | `cd frontend && npx ng test --watch=false` |
| Health check | `curl http://localhost:5000/api/health` |

## 8. Troubleshooting

### MongoDB does not start

- Check whether another MongoDB process already uses port `27017`.
- Confirm a `mongod` binary exists at a path known to `backend/scripts/start-db.js`, or run MongoDB
  through the system service and update `MONGODB_URI`.

### Backend cannot connect

- Confirm MongoDB is listening on `127.0.0.1:27017`.
- Check `MONGODB_URI` in `backend/.env`.
- Start the backend from `backend/` or use the root script so `.env` is loaded correctly.

### Frontend requests fail with CORS

- Confirm `CORS_ORIGIN=http://localhost:4200` in `backend/.env`.
- Confirm the frontend is running on port `4200`.
- Restart the backend after changing `.env`.

### Admin login fails

- Confirm the seed script ran against the same `MONGODB_URI` used by the backend.
- Confirm you are using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `backend/.env`.
- Check that the user's role is `admin` in the `users` collection.

### Upload fails

- Confirm the file is PDF, JPG or PNG and under 5 MB.
- Confirm its actual content matches its extension; renamed files are rejected.
- Confirm `backend/uploads/documents` exists and is writable.
- Confirm the application belongs to the signed-in applicant.

### Port already in use

Stop the process using ports `27017`, `5000` or `4200`, or change the port consistently in the
backend environment and Angular service URLs.

## 9. Likely viva questions and concise answers

### 1. Why did you choose the MEAN Stack?

MEAN uses JavaScript/TypeScript across the client, server and data layer, which reduces context
switching and keeps data in JSON form. Angular provides structure for a multi-view SPA, Express keeps
the API explicit and middleware-driven, Node.js handles many concurrent I/O requests efficiently, and
MongoDB suits hierarchical admission data and aggregation reporting.

### 2. Why MongoDB instead of a relational database?

Admission applications contain nested personal, academic and admission-choice sections that are
naturally stored as documents. The common read path can load an entire application in one document
read. MongoDB also provides aggregation pipelines for dashboard statistics. Relational databases
would be a good fit too, but this project intentionally demonstrates document modelling; unique
indexes still enforce identity and duplicate constraints.

### 3. What is Mongoose?

Mongoose is an ODM (Object Data Modelling) library for MongoDB and Node.js. It defines schemas,
applies validation and defaults, manages references and virtuals, provides middleware hooks such as
password hashing, and exposes query and aggregation APIs.

### 4. What is Express middleware?

Middleware is a function that receives `req`, `res` and `next`. It runs in order and can inspect or
modify the request, end the response or pass control onward. In this project, middleware handles CORS,
body parsing, logging, JWT verification, role checks, uploads and centralised error handling.

### 5. How does JWT authentication work?

On login, the server signs a token containing the user ID, role and email using a secret. The client
sends it as `Authorization: Bearer <token>`. On each protected request, the server verifies the
signature and expiry, then reloads the user from MongoDB before allowing access. The token is
stateless, so the server does not keep a session for each user.

### 6. Why is bcrypt used?

bcrypt is a deliberately slow password-hashing algorithm with a per-password salt. It makes brute-force
attacks more expensive than fast hashes such as SHA-256. The project hashes passwords with a cost
factor of 10, never stores plaintext, excludes the hash from normal queries and removes it from API
responses.

### 7. How is RBAC enforced?

The JWT identifies the user, but the backend reloads the user and checks the current role. The admin
router applies `authenticate` and `requireAdmin` to every route. Applicant submission and upload
routes apply `requireApplicant`. Services additionally enforce object ownership for applications and
documents. The frontend guards are only a navigation convenience; the server is the authority.

### 8. How does Multer work?

Multer parses `multipart/form-data` requests. In this project, disk storage writes the file with a
randomised filename. A file filter checks the extension and declared MIME type, Multer enforces the
5 MB limit, and custom middleware verifies the file's magic bytes before metadata is saved. Failed
requests trigger file cleanup.

### 9. Why store files on disk instead of in MongoDB?

Disk storage keeps the database small and makes streaming, content headers and cleanup simple. File
metadata is still stored in MongoDB for ownership and lookup. GridFS or object storage would be more
appropriate for large-scale or distributed deployments; local disk is acceptable for this POC but
needs backup and malware-scanning improvements in production.

### 10. What is an aggregation pipeline?

An aggregation pipeline is an ordered set of MongoDB stages that transforms documents. Each stage
takes the output of the previous stage, similar to a Unix pipeline. Stages can filter, group, sort,
reshape, join and compute values. The dashboard uses `$match` and `$group` to produce totals and
distributions.

### 11. Explain `$match` and `$group`.

`$match` filters documents using query syntax and is often placed first to reduce the data processed.
`$group` groups documents by a key (`_id`) and accumulates values such as `{ $sum: 1 }` for counts. For
example, grouping by `$status` produces the count of applications in each status.

### 12. How are duplicate applications prevented?

There are three layers: the UI hides the form when an application exists; the service performs a
proactive lookup by applicant and academic session; and a compound unique index on
`{ applicant, academicSession }` provides the database-level guarantee. A duplicate-key race is mapped
to HTTP `409`.

### 13. How is concurrency handled?

For administrator status changes, the server reads the current status and requires it to match the
expected previous status. On a replica set, the status update and audit insert run in one transaction.
On standalone MongoDB, an audit row is written first, an atomic conditional update is attempted, and
the audit row is removed if the update loses the race. The losing administrator receives HTTP `409`.
Concurrent submissions are similarly protected by the unique index and duplicate-key handling.

### 14. Why are status transitions restricted?

A free-form status field would allow skipped steps, contradictory states and unaudited decisions.
The centralised state machine permits only `Submitted → Under Review → Selected/Rejected` and makes
the final states terminal. This keeps the admissions process consistent, makes the UI predictable and
ensures every successful change is auditable.

### 15. What is audit history?

Audit history is an append-only record of status changes. Each entry stores the application, previous
status, new status, the user who made the change, remarks and a timestamp. The initial submission is
recorded too. The history is returned chronologically and supports accountability and dispute
resolution.

### 16. Explain the complete request-response lifecycle.

An Angular action calls a typed service method, which sends an HTTP request. The interceptor adds the
Bearer token. Express applies CORS, body parsing and route middleware, verifies the token, checks the
role, validates the body and calls the controller. The controller delegates to a service, which uses
Mongoose to read or write MongoDB. The result is wrapped in a JSON envelope by the response helper. If
an error occurs, the central error middleware maps it to the correct status code and a safe message.
Angular receives the response and updates loading, success, empty or error UI states. For documents,
the response is a binary stream instead of JSON.

### 17. What security checks were added?

JWT verification, forced applicant registration, role middleware, application/document ownership
checks, password hashing and non-exposure, upload extension/MIME/magic-byte validation, path-traversal
protection, sanitised filenames, safe 500 responses and duplicate/concurrency protections. The final
QA stage also removed exposed seeded credentials from the login UI and added submission audit
rollback.

### 18. What are the main limitations?

The project is a non-production POC. It lacks real-browser automation, persistent replica-set testing,
refresh-token revocation, email verification, rate limiting, antivirus scanning, object storage,
monitoring and backup automation. JWTs in `localStorage` are also an XSS consideration. These are
documented as future improvements rather than hidden.
