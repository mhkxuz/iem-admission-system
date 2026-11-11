# IEM Online Admission Management System — Upgrade Progress

## Upgrade Stage 1.1 — Database Models and Admission Session Management
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
Stage 1.1 replaced the static hardcoded academic session (`'2026-2027'`) with a database-backed `AcademicSession` Mongoose model and dynamic administrative session management APIs, while strictly preserving backward compatibility, existing records, compound indexes, and application submission flows.

---

### 2. Database Changes
- **New Model:** `AcademicSession` ([`backend/models/academic-session.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/academic-session.model.js))
  - `sessionName`: String, required, unique (e.g., `'2026-2027'`).
  - `sessionCode`: String, required, unique, uppercase, trimmed (e.g., `'AY2026-27'`).
  - `startDate`: Date.
  - `endDate`: Date.
  - `applicationStartDate`: Date.
  - `applicationEndDate`: Date.
  - `isActive`: Boolean, default `false`.
  - `status`: String enum `['Draft', 'Active', 'Closed']`, default `'Draft'`.
  - `description`: String.
  - `timestamps`: `createdAt`, `updatedAt`.
  - **Schema Validation**: Pre-validate hook enforces `startDate <= endDate`, `applicationStartDate <= applicationEndDate`, and `applicationStartDate <= endDate`.
  - **Compound / Unique Indexes**:
    - `{ sessionName: 1 }` (unique)
    - `{ sessionCode: 1 }` (unique)
    - `{ isActive: 1 }`
- **Application Model Preservation**:
  - The `Application.academicSession` field remains a `String` (not an ObjectId reference).
  - The `{ applicant: 1, academicSession: 1 }` unique compound index is fully preserved.
  - Application ID generation (`IEM-YYYY-XXXXX`) continues using `academicSession`.

---

### 3. APIs Introduced

#### A. Administrative Session Endpoints (Guarded by `authenticateToken` + `authorizeRoles('admin')`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/admin/sessions` | Create a new academic admission session (Draft by default). |
| `GET` | `/api/admin/sessions` | List all academic sessions sorted by `createdAt` descending. |
| `GET` | `/api/admin/sessions/:id` | Retrieve session details by MongoDB ID. |
| `PATCH` | `/api/admin/sessions/:id` | Update session dates, description, or status (cannot modify name/code). |
| `PATCH` | `/api/admin/sessions/:id/activate` | Atomically deactivate any active session and mark target as Active. |
| `PATCH` | `/api/admin/sessions/:id/close` | Mark session as Closed and set `isActive = false`. |

#### B. Public Active Session Endpoint
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/sessions/active` | Public endpoint returning the active session and application availability window. |

---

### 4. Application Submission Integration
- Updated `submitApplication` in [`backend/services/application.service.js`](file:///home/mhkxuz/mean-admission-system/backend/services/application.service.js):
  - Validates active academic session exists.
  - Rejects application submissions with HTTP 400 if no active session is found.
  - Rejects submissions if active session status is `Closed`.
  - Rejects submissions if current date falls outside `[applicationStartDate, applicationEndDate]`.
  - Dynamically assigns `academicSession: activeSession.sessionName`.
  - Preserves idempotent fallback `ensureDefaultSession()` for isolated test suites or fresh environments.

---

### 5. Files Created and Modified (Stage 1.1)

#### Files Created:
- `backend/models/academic-session.model.js`
- `backend/services/session.service.js`
- `backend/controllers/session.controller.js`
- `backend/routes/session.routes.js`
- `backend/scripts/seed-session.js`
- `backend/tests/session.test.js`

#### Files Modified:
- `backend/models/index.js`
- `backend/services/application.service.js`
- `backend/routes/admin.routes.js`
- `backend/app.js`
- `backend/server.js`

---

## Upgrade Stage 1.2 — Programme and Fee Management APIs
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
Stage 1.2 established the backend foundation for dynamic, database-backed Programme and Fee Management. Administrators can configure academic programmes with full eligibility criteria, seat capacities, and multi-session offerings. Fee structures are modeled independently with rigorous monetary validation, unique semester numbers, and automated total calculation consistency checks. Public endpoints expose active catalogues and fees while guarding internal administrative operations.

---

### 2. Database Changes
- **New Model:** `Programme` ([`backend/models/programme.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/programme.model.js))
  - `programmeName`: String, required, 2-150 chars.
  - `programmeCode`: String, required, unique, uppercase, indexed (e.g. `'BTECH-CSE'`).
  - `degreeLevel`: String enum `['Undergraduate', 'Postgraduate', 'Diploma', 'Doctoral']`, default `'Undergraduate'`.
  - `department`: String, required, indexed.
  - `degree`: String, required (e.g. `'B.Tech'`).
  - `description`: String.
  - `duration`: Number, required, min 0.5.
  - `durationUnit`: String enum `['years', 'semesters', 'months']`, default `'years'`.
  - `academicSession`: Reference to `AcademicSession`.
  - `offeredSessions`: Array of references to `AcademicSession`.
  - `sessionOfferings`: Subdocuments supporting session-specific availability and seat capacities.
  - `eligibility`: Structured subdocument (`minClass12Percentage`, `requiredClass12Subjects`, `acceptedAcademicStreams`, `acceptedEntranceExams`, `minEntranceScore`, `remarks`, `programmeSpecificCriteria`).
  - `seatCapacity`: Subdocument with `total` (min 0) and `categoryAllocations` array (`[{ category, seats }]`).
  - `requiredDocuments`: Array of String document names.
  - `isApplicationOpen`: Boolean, default `true`.
  - `displayOrder`: Number, default 0, indexed.
  - `isActive`: Boolean, default `true`, indexed.
  - **Pre-validate Validation**:
    - Ensures sum of `categoryAllocations` does not exceed `total` seat capacity.
    - Validates `minClass12Percentage` within `[0, 100]`.
    - Validates session-specific seat allocations if defined.
  - **Indexes**:
    - `{ programmeCode: 1 }` (unique)
    - `{ isActive: 1 }`
    - `{ department: 1 }`
    - `{ degreeLevel: 1 }`
    - `{ academicSession: 1 }`
    - `{ displayOrder: 1 }`

- **New Model:** `FeeStructure` ([`backend/models/fee-structure.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/fee-structure.model.js))
  - `programme`: Reference to `Programme`, required, indexed.
  - `academicSession`: Reference to `AcademicSession`, required, indexed.
  - `applicationFee`: Number, min 0, default 0.
  - `admissionFee`: Number, min 0, default 0.
  - `semesterFees`: Array of `{ semesterNumber: Number, amount: Number }`.
  - `additionalFees`: Array of `{ feeName: String, amount: Number, description: String }`.
  - `totalProgrammeFee`: Number, min 0.
  - `currency`: String, default `'INR'`.
  - `paymentInstructions`: String.
  - `isActive`: Boolean, default `true`, indexed.
  - **Pre-validate Validation**:
    - All monetary amounts must be >= 0.
    - Semester numbers must be integers >= 1 and unique within the fee structure.
    - Consistency Calculation Rule: `totalProgrammeFee = admissionFee + sum(semesterFees.amount) + sum(additionalFees.amount)`. Auto-computed if omitted; verified for consistency if provided.
  - **Indexes**:
    - `{ programme: 1, academicSession: 1 }` partial unique index for `{ isActive: true }` (`unique_active_fee_per_programme_session`).
    - `{ programme: 1 }`
    - `{ academicSession: 1 }`
    - `{ isActive: 1 }`

---

### 3. APIs Introduced (Stage 1.2)

#### A. Administrator Programme APIs (Guarded by `authenticateToken` + `requireAdmin`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/admin/programmes` | Create an academic programme with full eligibility and seat capacity. |
| `GET` | `/api/admin/programmes` | List programmes with search (`search`), filters (`department`, `degreeLevel`, `session`, `isActive`), and pagination (`page`, `limit`). |
| `GET` | `/api/admin/programmes/:id` | Retrieve full details of an academic programme. |
| `PATCH` | `/api/admin/programmes/:id` | Update programme details (prevents duplicate codes). |
| `PATCH` | `/api/admin/programmes/:id/activate` | Activate a programme (`isActive: true`). |
| `PATCH` | `/api/admin/programmes/:id/deactivate` | Deactivate a programme (`isActive: false`). |

#### B. Public Programme APIs
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/programmes` | List publicly available active programmes with optional filters (`department`, `degreeLevel`, `session`). |
| `GET` | `/api/programmes/:id` | Retrieve public details of an active programme by ID. |
| `GET` | `/api/programmes/code/:code` | Retrieve public details of an active programme by uppercase code. |

#### C. Administrator Fee APIs (Guarded by `authenticateToken` + `requireAdmin`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/admin/fees` | Create fee structure; deactivates previous active version for same programme and session. |
| `GET` | `/api/admin/fees` | List fee structures with filtering (`programme`, `academicSession`, `isActive`) and pagination. |
| `GET` | `/api/admin/fees/:id` | Retrieve fee structure by ID. |
| `PATCH` | `/api/admin/fees/:id` | Update fee structure with monetary and total consistency validation. |
| `PATCH` | `/api/admin/fees/:id/activate` | Activate fee structure; ensures single active fee structure per programme and session. |
| `PATCH` | `/api/admin/fees/:id/deactivate` | Deactivate fee structure. |

#### D. Public Fee APIs
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/fees/programme/:programmeId` | Retrieve active fee structure for a programme (by ID or code) in the active or queried session. |

---

### 4. Application Compatibility & Data Preservation
- `Application.admissionInfo.preferredDepartment` remains intact and unaffected.
- Existing `Application` and `User` models, records, and queries remain 100% operational.
- Existing application submission workflow and ID generation are fully preserved.
- Historical fee structures are never overwritten; deactivating an active fee preserves previous fee versions in MongoDB for auditing and application fidelity.

---

### 5. Files Created and Modified (Stage 1.2)

#### Files Created:
- `backend/models/programme.model.js`
- `backend/models/fee-structure.model.js`
- `backend/services/programme.service.js`
- `backend/services/fee.service.js`
- `backend/controllers/programme.controller.js`
- `backend/controllers/fee.controller.js`
- `backend/routes/programme.routes.js`
- `backend/routes/fee.routes.js`
- `backend/tests/programme-fee.test.js`

#### Files Modified:
- `backend/models/index.js`
- `backend/routes/admin.routes.js`
- `backend/app.js`

---

## Upgrade Stage 1.3 — Public Admission Website and Programme Catalogue
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
Stage 1.3 implemented the public-facing admission portal for the Institute of Engineering & Management (IEM). Prospective applicants and visitors can explore active admission sessions, browse published academic programmes with live search and multi-criteria filtering, inspect detailed programme eligibility and approved intake, view itemized fee schedules, follow the 8-step application journey, review portal FAQs, and track official announcements.

---

### 2. Frontend Features Implemented
1. **Public Homepage (`HomeComponent`)**:
   - Hero banner with IEM branding, session status badge, and clear calls-to-action ("Explore Programmes", "Apply Now").
   - Live Admission Session banner integrated with `GET /api/sessions/active`.
   - Key institutional highlights (Accreditation, 100% Online Process, Salt Lake Campus, Placements).
   - Dynamic catalogue preview showing featured programmes loaded from the database.
   - 8-Step Online Admission Journey overview.
   - Latest announcements notice board with clean empty state.
2. **Academic Programme Catalogue (`ProgrammesComponent`)**:
   - Full catalogue listing connected to `GET /api/programmes`.
   - Live client-side and multi-criteria search by name, code, or department.
   - Degree level filter (`Undergraduate`, `Postgraduate`, `Diploma`, `Doctoral`).
   - Dynamic department filter extracted from catalogue offerings.
   - Programme cards displaying code, degree, duration, seat intake, and eligibility summary.
   - Loading indicator, empty search results state, and error handling with retry button.
3. **Individual Programme Details & Fees (`ProgrammeDetailComponent`)**:
   - Dynamic route `/programmes/:id` supporting both MongoDB ObjectId and uppercase programme code (`:code`).
   - Breadcrumb navigation and application availability indicator.
   - Verified eligibility criteria breakdown: minimum Class 12 aggregate, mandatory subjects, accepted academic streams, accepted entrance exams, rank score guidelines, and departmental criteria.
   - Required document checklist (Class 10, Class 12, rank card scans).
   - Approved seat intake distribution by category.
   - Integrated fee breakdown table via `GET /api/fees/programme/:id`: application fee, admission fee, semester tuition breakdown, and institutional charges.
   - Clear distinction between published fee schedules and pending/unannounced fees (avoiding false ₹0 representations).
   - Contextual "Apply" action routing authenticated applicants to the application form or guests to registration.
4. **Admission Procedure Guide (`AdmissionProcessComponent`)**:
   - Step-by-step 8-stage journey:
     1. Portal Account Registration
     2. Explore Programmes & Eligibility
     3. Review Fee Structure & Payment Policies
     4. Complete Application Form
     5. Upload Mandatory Document Scans
     6. Formal Application Submission
     7. Real-Time Status Tracking
     8. Enrollment & Admission Finalization
   - Document upload specifications (PDF/PNG/JPEG under 5MB).
5. **Fee Schedules & Tuition Breakdown (`FeesComponent`)**:
   - Dropdown selector to inspect tuition and semester fees across all offered courses.
   - Itemized fee tables with grand totals and payment guidelines.
   - Graceful handling of unconfigured fee schedules with contact advisories.
6. **Portal Support & FAQs (`FaqsComponent`)**:
   - Categorized interactive accordion covering General Admissions, Application Submission, Document Uploads, and Status Tracking.
   - Contact support card with Salt Lake campus address and Admissions Desk details.
7. **Announcements Notice Board (`AnnouncementsComponent`)**:
   - Public notice board with verified circulars when available.
   - Standard empty state advising candidates on upcoming circular schedules without fabricating dates or mock data.
8. **Navigation & Layout Enhancements (`NavbarComponent` & `App`)**:
   - Integrated public links (`Home`, `Programmes`, `Admission Process`, `Fees`, `FAQs`, `Announcements`) alongside role-based dashboards (`Applicant Dashboard`, `Admin Dashboard`) and authentication actions (`Sign In`, `Register`, `Sign Out`).
   - Mobile responsive menu toggle.
   - Comprehensive footer with campus location, helpdesk contacts, quick links, and copyright notice.

---

### 3. APIs Integrated
| Method | Route | Consumed By | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sessions/active` | `PublicAdmissionService` -> `HomeComponent` | Retrieves current session name, code, application dates, and open status. |
| `GET` | `/api/programmes` | `PublicAdmissionService` -> `HomeComponent`, `ProgrammesComponent`, `FeesComponent` | Retrieves list of active academic programmes. |
| `GET` | `/api/programmes/:id` | `PublicAdmissionService` -> `ProgrammeDetailComponent` | Retrieves individual programme specifications by ID. |
| `GET` | `/api/programmes/code/:code` | `PublicAdmissionService` -> `ProgrammeDetailComponent` | Retrieves individual programme specifications by code. |
| `GET` | `/api/fees/programme/:programmeId` | `PublicAdmissionService` -> `ProgrammeDetailComponent`, `FeesComponent` | Retrieves active fee breakdown for a programme. |

---

### 4. Files Created and Modified (Stage 1.3)

#### Files Created:
- `frontend/src/app/core/models/session.model.ts`: ActiveSession interface.
- `frontend/src/app/core/models/programme.model.ts`: Programme and Eligibility interfaces.
- `frontend/src/app/core/models/fee.model.ts`: FeeStructure and SemesterFee interfaces.
- `frontend/src/app/core/services/public-admission.service.ts`: Client service for public API endpoints.
- `frontend/src/app/core/services/public-admission.service.spec.ts`: Unit tests for `PublicAdmissionService` (5 tests).
- `frontend/src/app/features/public/home/home.component.ts`: Public admission portal homepage.
- `frontend/src/app/features/public/home/home.component.spec.ts`: Tests for `HomeComponent` (4 tests).
- `frontend/src/app/features/public/programmes/programmes.component.ts`: Programme catalogue with search and filters.
- `frontend/src/app/features/public/programmes/programmes.component.spec.ts`: Tests for `ProgrammesComponent` (5 tests).
- `frontend/src/app/features/public/programme-detail/programme-detail.component.ts`: Programme specification and fee breakdown page.
- `frontend/src/app/features/public/programme-detail/programme-detail.component.spec.ts`: Tests for `ProgrammeDetailComponent` (4 tests).
- `frontend/src/app/features/public/admission-process/admission-process.component.ts`: 8-step admission procedure guide.
- `frontend/src/app/features/public/fees/fees.component.ts`: Programme fee selector and breakdown viewer.
- `frontend/src/app/features/public/fees/fees.component.spec.ts`: Tests for `FeesComponent` (3 tests).
- `frontend/src/app/features/public/faqs/faqs.component.ts`: Categorized interactive FAQs.
- `frontend/src/app/features/public/announcements/announcements.component.ts`: Public notices page with empty state.

#### Files Modified:
- `frontend/src/app/app.routes.ts`: Added public portal routes (`/`, `/programmes`, `/programmes/:id`, `/admission-process`, `/process`, `/fees`, `/faqs`, `/announcements`).
- `frontend/src/app/shared/components/navbar/navbar.component.ts`: Added public navigation links and responsive mobile toggle.
- `frontend/src/app/app.html`: Enhanced layout with comprehensive footer.
- `frontend/src/app/app.css`: Added styling for institutional footer.
- `PROGRESS.md`: Updated tracking to record Stage 1.3 completion.

---

### 5. Test and Build Execution Results

#### Frontend Test Suite (`npm --prefix frontend test -- --watch=false`)
- **Status:** PASSED
- **Test Suites:** 19 passed, 19 total (14 baseline + 5 new test suites)
- **Total Tests:** 90 passed, 0 failed (69 baseline + 21 new tests)
  - `public-admission.service.spec.ts` (5 tests) - PASSED
  - `home.component.spec.ts` (4 tests) - PASSED
  - `programmes.component.spec.ts` (5 tests) - PASSED
  - `programme-detail.component.spec.ts` (4 tests) - PASSED
  - `fees.component.spec.ts` (3 tests) - PASSED
  - Existing 14 test suites (69 tests) - ALL PASSED
- **Execution Time:** 5.38 s

#### Frontend Production Build (`npm --prefix frontend run build`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total Size:** 313.54 kB (Estimated transfer: 84.55 kB)
- **Lazy Chunks:** 16 chunks generated cleanly without errors

#### Backend Test Suite (`npm --prefix backend test`)
- **Status:** PASSED
- **Test Suites:** 11 passed, 11 total
- **Total Tests:** 182 passed, 0 failed
- **Execution Time:** 68.02 s

---

### 6. Known Issues / External Dependencies
- None. All pages load data dynamically from existing APIs, gracefully handle unconfigured data or network errors, and maintain strict visual consistency with the IEM branding.

---

### 7. Exact Next Task
- Completed Stage 1.3.

---

## Upgrade Stage 1.4 — Dynamic Application Form and Programme Selection
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
Stage 1.4 upgraded the applicant admission application form from a basic single-page form into a dynamic, programme-aware 6-step multi-step admission workflow. The new application form fetches active programmes and the active admission session from the database, allows candidates to filter and select their desired degree programme, dynamically evaluates qualification and stream eligibility criteria against administrative minimum requirements, supports pre-submission document staging with file size and type validation, provides a consolidated pre-submission review screen, and persists the selected programme and academic stream to MongoDB while preserving complete backward compatibility with all existing application records, unique compound indexes, and unit tests.

---

### 2. Multi-Step Form Workflow
The upgraded `ApplicationFormComponent` implements a 6-step guided experience:
1. **Step 1: Programme Selection & Overview**:
   - Displays active admission session banner (`activeSessionName`).
   - Fetches active programmes dynamically using `PublicAdmissionService.getProgrammes()`.
   - Offers degree level filtering (All, Undergraduate, Postgraduate) and live search by name, code, or department.
   - Interactive programme cards highlight duration, seat capacity, minimum Class 12 aggregate percentage, and accepted streams.
   - Selecting a programme automatically binds `selectedProgramme` and synchronizes `preferredDepartment`.
   - Preserves `#preferredDepartment` select in the DOM for automated tests and manual fallback.
2. **Step 2: Personal Information**:
   - Prefills candidate identity (`fullName`, `email`, `phone`) from authenticated session.
   - Validates `fullName`, `dob` (in the past), `gender`, `email`, `phone` (10 digits), `address`, `city`, `state`, `pincode` (6 digits).
   - Enforces field validation before advancing to Step 3.
3. **Step 3: Academic Credentials & Stream**:
   - Captures `class10Board`, `class10Percentage`, `class12Board`, `class12Percentage`, `class12PassingYear`, `entranceExamName`, `entranceExamScore`.
   - Introduces `academicStream` selection (`'Science (PCM)'`, `'Science (PCB)'`, `'Science (General)'`, `'Commerce'`, `'Arts'`, `'Vocational'`).
   - Enforces range and format constraints before advancing to Step 4.
4. **Step 4: Programme-Specific Validation & Category**:
   - Dynamically evaluates applicant's `class12Percentage` against `selectedProgramme.eligibility.minClass12Percentage`.
   - Verifies whether the selected `academicStream` is among the programme's `acceptedAcademicStreams`.
   - Displays visual eligibility status badges (Passed / Warning) with clear contextual explanations.
   - Displays required core subjects checklist with confirmation checkbox.
   - Captures `admissionCategory` (`General`, `OBC`, `SC`, `ST`, `EWS`, `Management`).
5. **Step 5: Document Checklist & Upload Preparation**:
   - Displays required document checklist based on programme and admission category.
   - Provides client-side file staging inputs for Class 10 Marksheet, Class 12 Marksheet, Entrance Scorecard, and Photograph.
   - Validates file types (PDF, JPEG, PNG) and file sizes (up to 5MB).
   - Shows staged files summary list with remove capability.
   - Notifies applicants that documents staged here will be automatically uploaded upon submission, and additional documents can be uploaded post-submission from the dashboard.
   - Preserves DOM container `#documentUploadSection` and classes `.upload-controls`, `.document-upload-control`.
6. **Step 6: Review & Final Submission**:
   - Consolidates complete applicant summary across Selected Programme, Personal Information, Academic Credentials, and Document Upload Status.
   - Displays certification declaration text: *"By submitting this form, I certify that all personal and academic details provided are accurate and genuine."*
   - Submits application to `POST /api/applications`.
   - Upon successful application creation, automatically uploads staged documents via `DocumentService.uploadDocument` and redirects to the Applicant Dashboard.

---

### 3. Backend Model, Service, and Validation Extensions
1. **Application Model** ([`backend/models/application.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/application.model.js)):
   - Added `academicInfo.academicStream`: `{ type: String, trim: true, default: '' }`.
   - Added `selectedProgramme`: `{ type: mongoose.Schema.Types.ObjectId, ref: 'Programme', index: true }`.
   - Preserved `Application.academicSession` as `String` and unique compound index `{ applicant: 1, academicSession: 1 }`.
   - Preserved `IEM-YYYY-XXXXX` application ID generation format.
2. **Application Validator** ([`backend/validators/application.validator.js`](file:///home/mhkxuz/mean-admission-system/backend/validators/application.validator.js)):
   - Updated `validateApplicationSubmission` to sanitize and pass `selectedProgramme` and `academicInfo.academicStream` to `req.sanitizedApplication`.
3. **Application Service** ([`backend/services/application.service.js`](file:///home/mhkxuz/mean-admission-system/backend/services/application.service.js)):
   - Resolves `selectedProgramme` by ObjectId or code when provided.
   - Rejects submission with HTTP 400 if programme is inactive or `isApplicationOpen === false`.
   - Harmonizes `admissionInfo.preferredDepartment` with `programme.department`.
   - Enforces `minClass12Percentage` cutoff check (rejection with descriptive 400 error).
   - Enforces `acceptedAcademicStreams` check (rejection with descriptive 400 error).
   - Populates `selectedProgramme` in `getMyApplication` and `getApplicationById`.
   - Preserves backward compatibility when `selectedProgramme` is omitted.
4. **Applicant Dashboard** ([`frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts)):
   - Displays `selectedProgramme` name and code in the dashboard summary grid when available.
   - Displays programme details (code, degree, department, duration) and academic stream in the collapsible full details panel.

---

### 4. Files Created and Modified (Stage 1.4)

#### Files Created:
- `backend/tests/application-programme.test.js`: Dedicated backend test suite for programme-linked application submission, eligibility validation, stream validation, and backward compatibility (6 tests).

#### Files Modified:
- `backend/models/application.model.js`: Added `selectedProgramme` ref and `academicInfo.academicStream`.
- `backend/validators/application.validator.js`: Allowed `selectedProgramme` and `academicStream` in sanitized submission payload.
- `backend/services/application.service.js`: Added programme existence, active status, Class 12 aggregate cutoff, and stream validations; populated `selectedProgramme` in queries.
- `frontend/src/app/core/models/application.model.ts`: Added `selectedProgramme?: any` and `academicStream?: string`.
- `frontend/src/app/features/applicant/application-form/application-form.component.ts`: Upgraded to 6-step dynamic form with stepper nav, programme selection, dynamic eligibility checks, document staging, and review.
- `frontend/src/app/features/applicant/application-form/application-form.component.spec.ts`: Enhanced test suite with mocks for `PublicAdmissionService` and `DocumentService`, preserving all 12 baseline tests and adding 5 new tests (17 total).
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts`: Added selected programme and academic stream display in summary and detail cards.
- `PROGRESS.md`: Recorded Stage 1.4 completion.

---

### 5. Test and Build Execution Results

#### Frontend Test Suite (`npm --prefix frontend test -- --watch=false`)
- **Status:** PASSED
- **Test Suites:** 19 passed, 19 total
- **Total Tests:** 95 passed, 0 failed (90 baseline + 5 new tests in `application-form.component.spec.ts`)
  - `application-form.component.spec.ts` (17 tests) - ALL PASSED
  - `applicant-dashboard.component.spec.ts` (11 tests) - ALL PASSED
  - All 17 other test suites (67 tests) - ALL PASSED
- **Execution Time:** 5.57 s

#### Frontend Production Build (`npm --prefix frontend run build`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total Size:** 313.55 kB (Estimated transfer: 84.56 kB)
- **Lazy Chunks:** Generated cleanly with no compilation or bundling errors

#### Backend Test Suite (`npm --prefix backend test`)
- **Status:** PASSED
- **Test Suites:** 12 passed, 12 total (11 baseline + 1 new test suite `application-programme.test.js`)
- **Total Tests:** 188 passed, 0 failed (182 baseline + 6 new tests)
  - `application-programme.test.js` (6 tests) - ALL PASSED
  - `application.test.js` (11 tests) - ALL PASSED
  - `admin.test.js` (15 tests) - ALL PASSED
  - `programme-fee.test.js` (15 tests) - ALL PASSED
  - `session.test.js` (13 tests) - ALL PASSED
  - `document.test.js` (15 tests) - ALL PASSED
  - `auth.test.js` (21 tests) - ALL PASSED
  - `stage1.test.js`, `stage6.test.js`, `stage7.test.js`, `stage8.integration.test.js`, `stage8.replica.test.js` - ALL PASSED
- **Execution Time:** 69.46 s

---

### 6. Next Task
- **Upgrade Stage 1.5 — Administrative Programme and Admission Session Configuration UI** (Completed below)

---

## Upgrade Stage 1.5 — Administrative Programme and Admission Session Configuration
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
Stage 1.5 finalized Upgrade Stage 1 by providing administrators with a unified, reactive control center to manage academic programmes, admission sessions, and fee structures directly within the admin portal. Administrators can configure seat allocations with real-time balance validation, manage session lifecycle transitions (Draft, Active, Closed) with atomic single-active-session guarantees, configure multi-term fee structures with dynamic total computation, view live configuration health metrics, and safely perform lifecycle actions under referential integrity protection.

---

### 2. Administrative Capabilities Delivered

#### A. Academic Programme Management
- **Interactive Catalogue**: Search by programme name, code, or department; filter by department, degree level, and active status.
- **Programme Configuration**: Full modal editor supporting name, code (uniqueness enforced), degree level, department, duration and duration unit, academic session reference, minimum Class 12 percentage, accepted streams, core subject prerequisites, total seat capacity, and required document checklist.
- **Seat Allocation & Balance Validation**: Live calculation of total allocated vs remaining unallocated seats across General, OBC, SC, ST, EWS, and Management categories. Rejects submission with clear inline feedback if category allocations exceed total capacity.
- **Intake & Visibility Controls**: Independent toggling for `isActive` (catalogue visibility) and `isApplicationOpen` (applicant submission availability).
- **Referential Integrity Protection**: Hard deletion (`DELETE /api/admin/programmes/:id`) checks whether applications reference the programme, throwing HTTP 400 with a descriptive warning rather than corrupting applicant records.

#### B. Admission Session Management
- **Session List & Active Banner**: Displays all sessions with status badges (`Draft`, `Active`, `Closed`), date spans, and a prominent banner identifying the currently active session.
- **Session Configuration**: Create and edit sessions with pre-validation enforcing `startDate <= endDate`, `applicationStartDate <= applicationEndDate`, and `applicationStartDate <= endDate`.
- **Atomic Single-Active Session Transition**: Activating a session automatically deactivates any existing active session in a single transactional step, accompanied by confirmation dialogs.
- **Session Closure**: Closing a session sets `status: 'Closed'` and `isActive: false`, immediately preventing new application submissions while safeguarding historical applicant submissions.
- **Referential Integrity Protection**: Hard deletion (`DELETE /api/admin/sessions/:id`) is blocked with HTTP 400 if any applications or programmes reference the session.

#### C. Fee Structure Configuration
- **Fee Management Dashboard**: Filter fee structures by programme and academic session, with quick overview cards.
- **Dynamic Breakdown Editor**:
  - Application Fee (processing fee, excluded from total programme fee).
  - Admission Fee (one-time enrollment fee).
  - Dynamic Semester Fees: Add/remove semester rows with term number, tuition fee, and lab/other fee per semester.
  - Dynamic Additional Charges: Add/remove incidental fee rows (library, development, alumni, etc.).
  - Payment terms and instructions.
- **Live Fee Calculation & Consistency**: Automatically computes `totalProgrammeFee = admissionFee + sum(semesterFees) + sum(additionalFees)` with non-negative validation and schema consistency.
- **Active Schedule Uniqueness**: Enforces that only one active fee schedule exists per programme and session.
- **Activation & Safe Deletion**: Toggle active status and delete unreferenced fee schedules.

#### D. Academic Overview & Configuration Health
- **Live Metric Cards**: Real-time aggregated statistics from `GET /api/admin/overview`:
  - Total Programmes, Active Programmes, Programmes Accepting Applications.
  - Total Sessions, Currently Active Session Name.
  - Configured Fee Structures, Programmes Missing Fee Configuration (Health Alert).
- **Configuration Health Table**: Highlighting programmes that lack an active fee structure to prevent unpriced application intakes.
- **Tabbed Admin Navigation**: Unified five-tab interface (`Applications Directory`, `Academic Programmes`, `Admission Sessions`, `Fee Structures`, `Academic Overview`) with query param deep-linking (`?tab=...`), preserving all Stage 1–9 admin functionality, CSS layout, and test DOM assertions.

---

### 3. Backend Service and API Extensions
- **Admin Service** ([`backend/services/admin.service.js`](file:///home/mhkxuz/mean-admission-system/backend/services/admin.service.js)):
  - Extended `getDashboardOverview()` to return `academicOverview` containing live counts for total programmes, active programmes, open programmes, total sessions, active session, configured fee structures, and programmes missing fee structures.
- **Programme Service & Controller** ([`backend/services/programme.service.js`](file:///home/mhkxuz/mean-admission-system/backend/services/programme.service.js), [`backend/controllers/programme.controller.js`](file:///home/mhkxuz/mean-admission-system/backend/controllers/programme.controller.js)):
  - Implemented `deleteProgramme` with referential integrity guard checking `Application.countDocuments({ selectedProgramme: id })`.
- **Session Service & Controller** ([`backend/services/session.service.js`](file:///home/mhkxuz/mean-admission-system/backend/services/session.service.js), [`backend/controllers/session.controller.js`](file:///home/mhkxuz/mean-admission-system/backend/controllers/session.controller.js)):
  - Implemented `deleteSession` with referential integrity guards checking `Application.countDocuments({ academicSession: session.sessionName })` and `Programme.countDocuments({ academicSession: id })`.
- **Fee Service & Controller** ([`backend/services/fee.service.js`](file:///home/mhkxuz/mean-admission-system/backend/services/fee.service.js), [`backend/controllers/fee.controller.js`](file:///home/mhkxuz/mean-admission-system/backend/controllers/fee.controller.js)):
  - Implemented `deleteFeeStructure`.
- **Admin Routes** ([`backend/routes/admin.routes.js`](file:///home/mhkxuz/mean-admission-system/backend/routes/admin.routes.js)):
  - Registered `DELETE /programmes/:id`, `DELETE /sessions/:id`, `DELETE /fees/:id`.

---

### 4. Files Created and Modified (Stage 1.5)

#### Backend Files Created:
- `backend/tests/stage1-5-admin-config.test.js`: Dedicated backend integration test suite verifying admin RBAC (401/403/200), academic overview statistics, programme deletion protection, session deletion protection, and fee deletion (7 tests).

#### Backend Files Modified:
- `backend/services/admin.service.js`: Added `academicOverview` calculation.
- `backend/services/programme.service.js`: Added `deleteProgramme`.
- `backend/controllers/programme.controller.js`: Added `deleteProgramme`.
- `backend/services/session.service.js`: Added `deleteSession`.
- `backend/controllers/session.controller.js`: Added `deleteSession`.
- `backend/services/fee.service.js`: Added `deleteFeeStructure`.
- `backend/controllers/fee.controller.js`: Added `deleteFeeStructure`.
- `backend/routes/admin.routes.js`: Registered `DELETE` routes for programmes, sessions, and fees.

#### Frontend Files Created:
- `frontend/src/app/core/models/session.model.ts`: Interface definitions for `AcademicSession`.
- `frontend/src/app/features/admin/overview/admin-overview.component.ts`: Overview cards, configuration health table, tab navigation dispatch.
- `frontend/src/app/features/admin/overview/admin-overview.component.spec.ts`: Unit test suite (3 tests).
- `frontend/src/app/features/admin/programmes/admin-programmes.component.ts`: Programme catalogue table, filters, create/edit modal, seat balance validator.
- `frontend/src/app/features/admin/programmes/admin-programmes.component.spec.ts`: Unit test suite (6 tests).
- `frontend/src/app/features/admin/sessions/admin-sessions.component.ts`: Session list, active session banner, modal editor, activation/closure confirmation.
- `frontend/src/app/features/admin/sessions/admin-sessions.component.spec.ts`: Unit test suite (5 tests).
- `frontend/src/app/features/admin/fees/admin-fees.component.ts`: Fee list/card view, dynamic semester and additional charges rows, live total fee calculator.
- `frontend/src/app/features/admin/fees/admin-fees.component.spec.ts`: Unit test suite (5 tests).

#### Frontend Files Modified:
- `frontend/src/app/core/models/programme.model.ts`: Added `isActive?: boolean`.
- `frontend/src/app/core/services/admin.service.ts`: Added `AcademicOverview` interface and methods for programmes, sessions, and fee structures.
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts`: Added tabbed navigation, query param sync, lazy subcomponent rendering, while preserving existing DOM structure and tests.
- `frontend/src/app/app.routes.ts`: Added direct child routes for `/admin/programmes`, `/admin/sessions`, `/admin/fees`, `/admin/overview`.
- `PROGRESS.md`: Recorded Stage 1.5 completion.

---

### 5. Test and Build Execution Results

#### Frontend Unit Test Suite (`npm --prefix frontend test -- --watch=false`)
- **Status:** PASSED
- **Test Suites:** 23 passed, 23 total (19 baseline + 4 new test suites)
- **Total Tests:** 114 passed, 0 failed (95 baseline + 19 new tests)
  - `admin-overview.component.spec.ts` (3 tests) - ALL PASSED
  - `admin-programmes.component.spec.ts` (6 tests) - ALL PASSED
  - `admin-sessions.component.spec.ts` (5 tests) - ALL PASSED
  - `admin-fees.component.spec.ts` (5 tests) - ALL PASSED
  - `admin-dashboard.component.spec.ts` (11 tests) - ALL PASSED
  - `admin-dashboard-applications.spec.ts` (4 tests) - ALL PASSED
  - `admin-dashboard-aggregation.spec.ts` (3 tests) - ALL PASSED
  - All other 16 frontend suites (77 tests) - ALL PASSED
- **Execution Time:** 6.13 s

#### Frontend Production Build (`npm --prefix frontend run build`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total Size:** 317.75 kB (Estimated transfer: 87.32 kB)
- **Lazy Chunks:** Generated cleanly with no compilation errors
- **Build Duration:** 4.829 s

#### Backend Test Suite (`npm --prefix backend test`)
- **Status:** PASSED
- **Test Suites:** 13 passed, 13 total (12 baseline + 1 new test suite `stage1-5-admin-config.test.js`)
- **Total Tests:** 195 passed, 0 failed (188 baseline + 7 new tests)
  - `stage1-5-admin-config.test.js` (7 tests) - ALL PASSED
  - `application-programme.test.js` (6 tests) - ALL PASSED
  - `application.test.js` (11 tests) - ALL PASSED
  - `admin.test.js` (15 tests) - ALL PASSED
  - `programme-fee.test.js` (15 tests) - ALL PASSED
  - `session.test.js` (13 tests) - ALL PASSED
  - `document.test.js` (15 tests) - ALL PASSED
  - `auth.test.js` (21 tests) - ALL PASSED
  - `stage1.test.js`, `stage6.test.js`, `stage7.test.js`, `stage8.integration.test.js`, `stage8.replica.test.js` - ALL PASSED
- **Execution Time:** 73.92 s

---

## Upgrade Stage 1 Overall Status: 100% COMPLETED
All five sequential stages of Upgrade Stage 1 have been implemented, verified, and integrated:
- **Stage 1.1:** Database Models and Admission Session Management — COMPLETED
- **Stage 1.2:** Programme and Fee Management APIs — COMPLETED
- **Stage 1.3:** Public Admission Website Implementation — COMPLETED
- **Stage 1.4:** Dynamic Application Form and Programme Selection — COMPLETED
- **Stage 1.5:** Administrative Programme and Admission Session Configuration — COMPLETED

---

### 6. Completed Stage
- **Upgrade Stage 2 — Document Verification Sub-Workflow & Reviewer Role** (Completed below)

---

## Upgrade Stage 2 — Document Verification Sub-Workflow & Reviewer Role
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
Stage 2 introduced a multi-role administrative access architecture featuring a dedicated `reviewer` role and an append-only document verification sub-workflow. Reviewers can inspect documents in a dedicated Verification Desk, approve credentials, or reject documents with mandatory explanatory remarks. Applicants receive live verification status feedback with inline guidance and a replacement upload flow for rejected documents, without mutating overall application admission status. Administrators maintain complete oversight through the Inspection Modal and a dedicated Reviewer Management portal to assign and revoke reviewer privileges.

---

### 2. Core Features Implemented

#### A. Reviewer Role & RBAC System
- **Three-Tier Role Hierarchy**: Extended `User.role` enum to `['applicant', 'admin', 'reviewer']`.
- **Reviewer Permissions**: Reviewers authenticate through standard login and receive access exclusively to document queue inspection, viewing, downloading, and verification. They are strictly prohibited from modifying application admission decisions, altering programme/session/fee configurations, or accessing administrative controls.
- **Administrative Role Assignment**: Added administrative APIs (`GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, `POST /api/admin/users/reviewer`) allowing admins to assign or revoke reviewer privileges with safeguards preventing administrator self-demotion lockout.
- **Seed Reviewer Utility**: Added `backend/scripts/seed-reviewer.js` provisioning `reviewer@iem.edu`.

#### B. Document Verification Data Model & Audit History
- **Model Extensions** ([`backend/models/uploaded-document.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/uploaded-document.model.js)):
  - `verificationStatus`: String enum `['Pending', 'Verified', 'Rejected']`, default `'Pending'`, indexed.
  - `verifiedBy`: ObjectId ref `User`, default `null`.
  - `verificationRemarks`: String, trim, default `''`.
  - `verifiedAt`: Date, default `null`.
  - `replacedBy`: ObjectId ref `UploadedDocument`, default `null`.
  - Full backward compatibility: documents created prior to Stage 2 safely resolve to `Pending`.
- **Append-Only Verification History Model** ([`backend/models/document-verification-history.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/document-verification-history.model.js)):
  - Tracks `document`, `application`, `previousStatus`, `newStatus`, `verifiedBy`, `remarks`, and `timestamp`.
  - Preserves immutable historical decisions across repeated reviews or re-uploads.

#### C. Verification Sub-Workflow APIs
- `GET /api/documents/queue` & `GET /api/documents/pending`: Filterable queue by verification status, document type, and search term (application ID, candidate name, email).
- `PATCH /api/documents/:id/verify`: Approves (`Verified`) or rejects (`Rejected`) a document. Enforces mandatory remarks on rejection, records verifier identity and timestamp, and appends to audit history. Restricted to `reviewer` and `admin`.
- `GET /api/documents/:id/history`: Retrieves verification audit trail.
- `GET /api/documents/application/:applicationId`: Enhanced to populate verifier details (`fullName email role`).
- `POST /api/documents/upload`: Enhanced to establish `replacedBy` link when replacing a previously rejected document, initializing the replacement to `Pending`.

#### D. Dedicated Reviewer Dashboard
- Implemented [`ReviewerDashboardComponent`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/features/reviewer/dashboard/reviewer-dashboard.component.ts) at `/reviewer/dashboard` guarded by `authGuard` and `reviewerGuard`.
- Real-time metric cards (Pending Review, Verified, Rejected, Total in Queue).
- Filter toolbar (status, document type, instant search).
- Inline document preview via `DocumentService.viewDocument()` and download via `DocumentService.downloadDocument()`.
- Approval modal with optional remarks; Rejection modal with mandatory remarks validation.
- Audit history modal displaying chronological decision timeline.

#### E. Applicant Dashboard Integration
- Document table in [`ApplicantDashboardComponent`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts) upgraded with verification status badges (`Pending`, `Verified`, `Rejected`).
- Rejected documents display prominent contextual alerts with the reviewer's remarks and an interactive "Replace" button.
- Replacement upload automatically targets the rejected document category, sets the replacement to `Pending`, and preserves historical audit records without altering `application.status`.

#### F. Administrative Visibility & Reviewer Management
- **Application Inspection Modal**: Uploaded documents section displays verification status badges, verifier name, timestamp, and remarks.
- **Reviewer Management Tab**: Embedded in [`AdminDashboardComponent`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts) with direct actions to promote applicants to reviewers, revoke reviewer access, and provision reviewer accounts.

---

### 3. Files Created and Modified (Stage 2)

#### Backend Files Created:
- `backend/models/document-verification-history.model.js`
- `backend/scripts/seed-reviewer.js`
- `backend/tests/stage2-document-verification.test.js`

#### Backend Files Modified:
- `backend/models/user.model.js`
- `backend/models/uploaded-document.model.js`
- `backend/models/index.js`
- `backend/middleware/role.middleware.js`
- `backend/services/document.service.js`
- `backend/controllers/document.controller.js`
- `backend/routes/document.routes.js`
- `backend/services/admin.service.js`
- `backend/controllers/admin.controller.js`
- `backend/routes/admin.routes.js`

#### Frontend Files Created:
- `frontend/src/app/features/reviewer/dashboard/reviewer-dashboard.component.ts`
- `frontend/src/app/features/reviewer/dashboard/reviewer-dashboard.component.spec.ts`
- `frontend/src/app/features/admin/reviewers/admin-reviewers.component.ts`
- `frontend/src/app/features/admin/reviewers/admin-reviewers.component.spec.ts`

#### Frontend Files Modified:
- `frontend/src/app/core/models/user.model.ts`
- `frontend/src/app/core/models/document.model.ts`
- `frontend/src/app/core/services/auth.service.ts`
- `frontend/src/app/core/guards/auth.guard.ts`
- `frontend/src/app/core/guards/auth.guard.spec.ts`
- `frontend/src/app/core/services/document.service.ts`
- `frontend/src/app/core/services/admin.service.ts`
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts`
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.spec.ts`
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts`
- `frontend/src/app/shared/components/navbar/navbar.component.ts`
- `frontend/src/app/features/auth/login/login.component.ts`
- `frontend/src/app/app.routes.ts`
- `PROGRESS.md`

---

### 4. Test and Build Execution Results

#### Backend Test Suite (`npm --prefix backend test`)
- **Status:** PASSED
- **Test Suites:** 14 passed, 14 total (13 baseline + 1 new suite `stage2-document-verification.test.js`)
- **Total Tests:** 218 passed, 0 failed (195 baseline + 23 new tests)
  - `stage2-document-verification.test.js` (23 tests) - ALL PASSED
  - `stage1-5-admin-config.test.js` (7 tests) - ALL PASSED
  - `application-programme.test.js` (6 tests) - ALL PASSED
  - `application.test.js` (11 tests) - ALL PASSED
  - `admin.test.js` (15 tests) - ALL PASSED
  - `programme-fee.test.js` (15 tests) - ALL PASSED
  - `session.test.js` (13 tests) - ALL PASSED
  - `document.test.js` (15 tests) - ALL PASSED
  - `auth.test.js` (21 tests) - ALL PASSED
  - All historical test suites (`stage1.test.js`, `stage6.test.js`, `stage7.test.js`, `stage8.integration.test.js`, `stage8.replica.test.js`): ALL PASSED
- **Execution Time:** 86.68 s

#### Frontend Unit Test Suite (`npm --prefix frontend test -- --watch=false`)
- **Status:** PASSED
- **Test Suites:** 25 passed, 25 total (23 baseline + 2 new suites)
- **Total Tests:** 128 passed, 0 failed (114 baseline + 14 new tests)
  - `reviewer-dashboard.component.spec.ts` (6 tests) - ALL PASSED
  - `admin-reviewers.component.spec.ts` (4 tests) - ALL PASSED
  - `auth.guard.spec.ts` (8 tests) - ALL PASSED
  - `applicant-dashboard.component.spec.ts` (13 tests) - ALL PASSED
  - `admin-dashboard.component.spec.ts` (6 tests) - ALL PASSED
  - All other 20 frontend suites (91 tests) - ALL PASSED
- **Execution Time:** 7.54 s

#### Frontend Production Build (`npm --prefix frontend run build`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total:** 318.82 kB (raw) / 87.40 kB (estimated transfer)
- **Lazy Chunks:**
  - `reviewer-dashboard-component`: 31.91 kB (raw) / 7.06 kB (transfer)
  - `admin-dashboard-component`: 52.58 kB (raw) / 10.51 kB (transfer)
  - `applicant-dashboard-component`: 30.44 kB (raw) / 6.89 kB (transfer)
  - All chunks compiled cleanly without syntax or bundle errors

---

## Upgrade Stage 2 Status: COMPLETED

### 5. Exact Next Stage
- **Upgrade Stage 3 — Merit List Generation and Category-Wise Seat Allocation** (per `PROJECT_SPEC.md`).
- *(Note: Do NOT begin Stage 3 until requested).*

---

## Upgrade Stage 3 — Merit List Generation, Cutoff Engine and Category-Wise Seat Allocation
**Status:** Completed  
**Completion Date:** 2026-11-11  

---

### 1. Summary of Changes
Stage 3 implements a complete, enterprise-grade merit calculation and category-wise seat allocation system for the IEM Online Admission Management System:
1. **Configurable Merit Scoring Engine:** Enables administrators to define programme-specific and session-specific Class 12 aggregate percentage weightage and entrance exam score/rank weightage summing to exactly 100%, customizable normalization strategies (`Score-Based`, `Rank-Based`, `Percentile`), and sequential tie-breaking priorities.
2. **Deterministic Eligibility Screening:** Evaluates programme active status, session match, minimum aggregate percentage cutoff, accepted streams, entrance exam requirement, and uploaded document verification statuses (`Eligible`, `Eligible (Pending Documents)`, `Ineligible`) with explicit exclusion remarks.
3. **Merit List Generation & Cutoff Computation:** Computes composite scores, overall merit ranks, category ranks, and programme-wide + category-wise cutoff statistics with full version tracking and draft/published lifecycle.
4. **Category-Wise Seat Allocation Engine:** Implements the official seat allocation algorithm where Open/General merit seats are filled first strictly by overall merit rank among all candidates regardless of category, followed by reserved category quotas (`OBC`, `SC`, `ST`, `EWS`, `Management`), configurable unfilled seat handling (`Keep Vacant` vs `Convert to General`), and duplicate/over-allocation prevention.
5. **Administrative Approval & Publishing Workflow:** Enforces structured multi-step review (`Draft` -> `Approved` -> `Published`) with an audit history log recording admin identity, timestamps, and remarks, while preserving the existing Application status state machine.
6. **Applicant Portal Integration:** Exposes caller's published merit score, rank, category rank, allocation status, allocated category, seat number, reason, and cutoff summaries securely without exposing private applicant data.

---

### 2. Database Changes

#### A. New Model: `MeritConfiguration` (`backend/models/merit-configuration.model.js`)
- `programme`: ObjectId reference to `Programme`, required, indexed.
- `academicSession`: String, required, indexed.
- `class12Weightage`: Number, default `60`.
- `entranceExamWeightage`: Number, default `40`.
- `normalizationMethod`: String enum `['Score-Based', 'Rank-Based', 'Percentile']`, default `'Rank-Based'`.
- `maxEntranceRank`: Number, default `50000`.
- `maxEntranceScore`: Number, default `100`.
- `tieBreakingPriority`: Array of String rules (`['entranceExamScore', 'class12Percentage', 'class10Percentage', 'dob']`).
- `unfilledSeatRule`: String enum `['Keep Vacant', 'Convert to General']`, default `'Keep Vacant'`.
- `version`: Number, default `1` (increments upon update).
- `updatedBy`: ObjectId reference to `User`.
- **Pre-validate Hook:** Enforces `class12Weightage + entranceExamWeightage === 100`.
- **Compound Index:** `{ programme: 1, academicSession: 1 }` (unique).

#### B. New Model: `MeritList` (`backend/models/merit-list.model.js`)
- `programme`: ObjectId reference to `Programme`, required, indexed.
- `academicSession`: String, required, indexed.
- `version`: Number, default `1`.
- `status`: String enum `['Draft', 'Published', 'Archived']`, default `'Draft'`.
- `publishedAt`: Date.
- `publishedBy`: ObjectId reference to `User`.
- `entries`: Array of subdocuments:
  - `application`: ObjectId ref `Application`
  - `applicant`: ObjectId ref `User`
  - `applicationId`: String
  - `candidateName`: String
  - `category`: String enum `['General', 'OBC', 'SC', 'ST', 'EWS', 'Management']`
  - `class12Percentage`: Number
  - `rawEntranceScore`: String
  - `normalizedEntranceScore`: Number
  - `compositeScore`: Number (indexed)
  - `meritRank`: Number (0 for ineligible, indexed)
  - `categoryRank`: Number
  - `eligibilityStatus`: String enum `['Eligible', 'Eligible (Pending Documents)', 'Ineligible']`
  - `eligibilityRemarks`: String
  - `documentStatus`: String
- `cutoffs`:
  - `highestScore`: Number
  - `lowestShortlistedScore`: Number
  - `categoryCutoffs`: Array of `{ category, highestScore, lowestScore, totalApplicants, eligibleApplicants }`
  - `totalEligible`: Number
  - `totalIneligible`: Number
  - `totalPendingDocs`: Number
- **Compound Index:** `{ programme: 1, academicSession: 1, status: 1 }`.

#### C. New Model: `SeatAllocation` (`backend/models/seat-allocation.model.js`)
- `programme`: ObjectId reference to `Programme`, required, indexed.
- `academicSession`: String, required, indexed.
- `meritList`: ObjectId reference to `MeritList`.
- `version`: Number, default `1`.
- `status`: String enum `['Draft', 'Approved', 'Published', 'Archived']`, default `'Draft'`.
- `totalSeats`: Number.
- `allocatedSeats`: Number.
- `remainingSeats`: Number.
- `unfilledSeatRule`: String enum `['Keep Vacant', 'Convert to General']`.
- `categorySummary`: Array of `{ category, totalSeats, allocatedSeats, remainingSeats }`.
- `allocations`: Array of subdocuments:
  - `application`: ObjectId ref `Application`
  - `applicant`: ObjectId ref `User`
  - `applicationId`: String
  - `candidateName`: String
  - `meritRank`: Number
  - `categoryRank`: Number
  - `appliedCategory`: String
  - `allocatedCategory`: String
  - `compositeScore`: Number
  - `allocationStatus`: String enum `['Allocated', 'Waitlisted', 'Ineligible']`
  - `allocationReason`: String
  - `seatNumber`: Number
- `approvedBy`, `approvedAt`, `publishedBy`, `publishedAt`.
- `history`: Array of `{ action, performedBy, timestamp, remarks }`.
- **Compound Index:** `{ programme: 1, academicSession: 1, status: 1 }`.

---

### 3. APIs Introduced

#### A. Administrative Merit & Allocation Endpoints (Guarded by `authenticateToken` + `requireRole('admin')`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/merit/configuration` | Save or update programme & session merit configuration (validates 100% sum). |
| `GET` | `/api/merit/configuration` | Retrieve active or default configuration (`?programmeId=...&academicSession=...`). |
| `POST` | `/api/merit/generate` | Generate draft merit list with cutoffs & screening. |
| `GET` | `/api/merit/lists` | List merit lists with optional filters. |
| `GET` | `/api/merit/lists/:id` | Retrieve detailed merit list by ID. |
| `POST` | `/api/merit/lists/:id/publish` | Publish merit list, archiving previous published versions. |
| `POST` | `/api/merit/allocation/generate` | Compute category-wise seat allocation draft. |
| `GET` | `/api/merit/allocation` | List seat allocations with optional filters. |
| `GET` | `/api/merit/allocation/:id` | Retrieve seat allocation details and audit trail by ID. |
| `POST` | `/api/merit/allocation/:id/approve` | Approve draft seat allocation with administrative audit remarks. |
| `POST` | `/api/merit/allocation/:id/publish` | Publish approved seat allocation to applicant portal with audit remarks. |

#### B. Applicant Outcome Endpoint (Guarded by `authenticateToken` + `requireRole('applicant')`)
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/merit/my-result` | Returns caller's published merit rank, score, category rank, allocation status, allocated category, seat number, reason, and programme cutoffs. Returns `hasPublishedResult: false` if unpublished. |

---

### 4. Files Created and Modified (Stage 3)

#### Files Created:
- `backend/models/merit-configuration.model.js`
- `backend/models/merit-list.model.js`
- `backend/models/seat-allocation.model.js`
- `backend/services/merit.service.js`
- `backend/controllers/merit.controller.js`
- `backend/routes/merit.routes.js`
- `backend/tests/stage3-merit-allocation.test.js`
- `frontend/src/app/core/models/merit.model.ts`
- `frontend/src/app/core/services/merit.service.ts`
- `frontend/src/app/core/services/merit.service.spec.ts`
- `frontend/src/app/features/admin/merit/admin-merit.component.ts`
- `frontend/src/app/features/admin/merit/admin-merit.component.spec.ts`

#### Files Modified:
- `backend/models/index.js` (Exported `MeritConfiguration`, `MeritList`, `SeatAllocation`)
- `backend/app.js` (Registered `/api/merit` routes)
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts` (Integrated `'merit'` tab & `app-admin-merit`)
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts` (Integrated published merit & allocation card)
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.spec.ts` (Added test for published result rendering)
- `frontend/src/app/app.routes.ts` (Added `/admin/merit` route)
- `PROGRESS.md`

---

### 5. Test and Build Execution Results

#### Backend Test Suite (`npm --prefix backend test`)
- **Status:** PASSED (Exit code: 0)
- **Test Suites:** 15 passed, 15 total (14 baseline + 1 new suite `stage3-merit-allocation.test.js`)
- **Total Tests:** 229 passed, 0 failed (218 baseline + 11 new tests)
  - `stage3-merit-allocation.test.js` (11 tests) - ALL PASSED
  - `stage2-document-verification.test.js` (23 tests) - ALL PASSED
  - `stage1-5-admin-config.test.js` (7 tests) - ALL PASSED
  - `application-programme.test.js` (6 tests) - ALL PASSED
  - `application.test.js` (11 tests) - ALL PASSED
  - `admin.test.js` (15 tests) - ALL PASSED
  - `programme-fee.test.js` (15 tests) - ALL PASSED
  - `session.test.js` (13 tests) - ALL PASSED
  - `document.test.js` (15 tests) - ALL PASSED
  - `auth.test.js` (21 tests) - ALL PASSED
  - All historical test suites (`stage1.test.js`, `stage6.test.js`, `stage7.test.js`, `stage8.integration.test.js`, `stage8.replica.test.js`): ALL PASSED
- **Execution Time:** ~92 s

#### Frontend Unit Test Suite (`npm --prefix frontend test -- --watch=false`)
- **Status:** PASSED (Exit code: 0)
- **Test Files:** 27 passed, 27 total (25 baseline + 2 new suites)
- **Total Tests:** 142 passed, 0 failed (128 baseline + 14 new tests)
  - `merit.service.spec.ts` (6 tests) - ALL PASSED
  - `admin-merit.component.spec.ts` (7 tests) - ALL PASSED
  - `applicant-dashboard.component.spec.ts` (14 tests) - ALL PASSED
  - All other 24 frontend suites (115 tests) - ALL PASSED
- **Execution Time:** ~6.35 s

#### Frontend Production Build (`npm --prefix frontend run build`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total:** 318.97 kB (raw) / 87.45 kB (estimated transfer)
- **Lazy Chunks:**
  - `admin-dashboard-component`: 52.98 kB (raw) / 10.61 kB (transfer)
  - `applicant-dashboard-component`: 36.88 kB (raw) / 7.98 kB (transfer)
  - All chunks compiled cleanly with zero syntax or bundle errors

---

## Upgrade Stage 3 Status: COMPLETED

---

## Upgrade Stage 4 — Admission Confirmation, Fee Payment Integration and Final Enrolment
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
Upgrade Stage 4 introduces the end-to-end admission confirmation and final enrolment workflow for candidates who have secured an allocated seat in published seat allocations. It bridges academic merit evaluation with formal admission through secure fee payment processing, permanent enrolment generation, transactional notifications, and administrative reconciliation.

Key capabilities delivered:
- **Admission Confirmation Eligibility Engine**: Multi-condition validation requiring a published seat allocation with status `Allocated` (rejecting `Waitlisted` or `Ineligible`), active academic session, mandatory verified documents (`Class 10 Marksheet` and `Class 12 Marksheet` verified by reviewers with zero rejections), active fee structure, and duplicate confirmation prevention.
- **Dynamic Fee Management & Fee Snapshot**: Reuses existing `FeeStructure` model, extracts admission fee and total programme fee, and captures an immutable point-in-time snapshot of fees on the payment order.
- **Secure Payment Gateway Integration**: Dual-mode payment gateway supporting both an interactive development/sandbox mode (cryptographic signature verification without live charges) and live production mode configurable via environment variables (`PAYMENT_GATEWAY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`).
- **Cryptographic Signature Verification & Webhook Handling**: HMAC-SHA256 signature verification for applicant verification and asynchronous webhook event handling (`payment.captured`, `order.paid`, `payment.failed`).
- **Final Admission Confirmation & Enrolment**: Generates a permanent, unique student enrolment number formatted as `ENR-YYYY-XXXXX` (e.g., `ENR-2026-00001`), recorded in a dedicated `Enrolment` collection with strict database-level unique constraints preventing multiple enrolments per application.
- **Preservation of Application Status Machine**: Application status state machine (`Submitted` &rarr; `Under Review` &rarr; `Selected`/`Rejected`) remains intact; enrolment and confirmed status are tracked in the `Enrolment` and `Payment` models without bypassing review workflows.
- **Applicant Portal Interface**: Interactive dashboard card displaying eligibility status, fee amount, checkout modal with sandbox test simulation, confirmed admission banner with permanent enrolment number, and printable official admission confirmation receipt.
- **Administrative Enrolment & Payment Management**: Enrolment directory, payment transaction table with status badges (`Successful`, `Pending`, `Failed`, `Initiated`, `Cancelled`), payment inspection modal with full audit timeline, manual reconciliation with mandatory remarks, and real-time revenue collection KPIs.
- **Transactional Notifications Subsystem**: Notification model and service logging and delivering notifications for `Payment_Initiated`, `Payment_Successful`, `Payment_Failed`, `Admission_Confirmed`, and `Enrolment_Issued`.

---

### 2. Database Changes
- **New Model: `Payment`** ([`backend/models/payment.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/payment.model.js))
  - `applicant`: ObjectId reference to `User` (required, indexed)
  - `application`: ObjectId reference to `Application` (required, indexed)
  - `programme`: ObjectId reference to `Programme` (required, indexed)
  - `academicSession`: String (required, indexed)
  - `feeStructure`: ObjectId reference to `FeeStructure` (required)
  - `orderId`: String, unique (indexed)
  - `paymentId`: String, sparse unique (indexed)
  - `amount`: Number, required
  - `currency`: String, default `'INR'`
  - `status`: Enum `['Initiated', 'Pending', 'Successful', 'Failed', 'Cancelled']`, default `'Initiated'`
  - `gateway`: String, default `'sandbox'`
  - `feeSnapshot`: Object storing `admissionFee`, `totalProgrammeFee`, `currency`, `description`, `feeStructureId`
  - `signature`: String
  - `failureReason`: String
  - `idempotencyKey`: String, sparse index
  - `auditHistory`: Array of audit entries `{ action, timestamp, details, source }`
  - `paidAt`: Date
  - Timestamps: `createdAt`, `updatedAt`

- **New Model: `Enrolment`** ([`backend/models/enrolment.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/enrolment.model.js))
  - `enrolmentNumber`: String, unique (format: `ENR-YYYY-XXXXX`, indexed)
  - `applicant`: ObjectId reference to `User` (required, indexed)
  - `application`: ObjectId reference to `Application` (unique: true, indexed)
  - `applicationId`: String, required (format: `IEM-YYYY-XXXXX`)
  - `programme`: ObjectId reference to `Programme` (required, indexed)
  - `academicSession`: String, required (indexed)
  - `allocatedCategory`: String, required
  - `seatNumber`: Number, nullable
  - `payment`: ObjectId reference to `Payment` (unique: true, indexed)
  - `paymentReference`: String, required
  - `feeAmountPaid`: Number, required
  - `currency`: String, default `'INR'`
  - `enrolmentStatus`: Enum `['Confirmed', 'Cancelled']`, default `'Confirmed'`
  - `confirmedAt`: Date, default `Date.now`
  - `confirmedBy`: ObjectId reference to `User`
  - `remarks`: String
  - `auditTrail`: Array of audit events `{ action, performedBy, timestamp, remarks }`
  - Timestamps: `createdAt`, `updatedAt`

- **New Model: `Notification`** ([`backend/models/notification.model.js`](file:///home/mhkxuz/mean-admission-system/backend/models/notification.model.js))
  - `recipient`: ObjectId reference to `User` (required, indexed)
  - `recipientEmail`: String, required, lowercase
  - `type`: Enum `['Payment_Initiated', 'Payment_Successful', 'Payment_Failed', 'Admission_Confirmed', 'Enrolment_Issued']`
  - `title`: String, required
  - `message`: String, required
  - `metadata`: Mixed
  - `deliveryStatus`: Enum `['Sent', 'Queued', 'Failed']`, default `'Sent'`
  - `sentAt`: Date, default `Date.now`

- **Preservation of Existing Schemas**:
  - `Application.academicSession` remains a `String` (not changed to ObjectId).
  - `{ applicant: 1, academicSession: 1 }` compound unique index on `Application` is untouched.
  - `UploadedDocument` files, storage paths, and verification histories are preserved.
  - Existing admin, reviewer, and applicant user records are completely preserved.

---

### 3. APIs Introduced
All payment and confirmation endpoints mounted at `/api/payments`:

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/webhook` | Public | Asynchronous payment gateway webhook notification endpoint with HMAC verification. |
| `GET` | `/api/payments/eligibility` | Applicant | Checks whether the logged-in applicant is eligible for seat confirmation & fee payment. |
| `POST` | `/api/payments/order` | Applicant | Initiates payment order, calculates fee from active structure, creates order in gateway/sandbox. |
| `POST` | `/api/payments/verify` | Applicant | Verifies cryptographic payment signature and completes final enrolment atomically. |
| `GET` | `/api/payments/receipt` | Applicant | Retrieves confirmed admission receipt, permanent enrolment number, and transaction details. |
| `GET` | `/api/payments` | Admin | Lists all payment transactions with pagination, search, and status filtering. |
| `GET` | `/api/payments/:id` | Admin | Retrieves specific payment transaction details along with audit timeline. |
| `POST` | `/api/payments/:id/reconcile` | Admin | Manually reconciles payment (`MarkSuccessful`, `MarkFailed`, `Cancel`) with mandatory remarks. |
| `GET` | `/api/payments/enrolments/all` | Admin | Lists all confirmed permanent enrolments with search and filters. |
| `GET` | `/api/payments/enrolments/statistics` | Admin | Real-time admission and fee collection analytics (total enrolled, revenue, pending, breakdown). |

---

### 4. Files Created and Modified (Stage 4)

#### Files Created:
- `backend/models/payment.model.js`
- `backend/models/enrolment.model.js`
- `backend/models/notification.model.js`
- `backend/services/payment.service.js`
- `backend/services/notification.service.js`
- `backend/controllers/payment.controller.js`
- `backend/routes/payment.routes.js`
- `backend/tests/stage4-enrolment-payment.test.js`
- `frontend/src/app/core/models/payment.model.ts`
- `frontend/src/app/core/services/payment.service.ts`
- `frontend/src/app/core/services/payment.service.spec.ts`
- `frontend/src/app/features/admin/enrolment/admin-enrolment.component.ts`
- `frontend/src/app/features/admin/enrolment/admin-enrolment.component.spec.ts`

#### Files Modified:
- `backend/models/index.js` (Exported `Payment`, `Enrolment`, `Notification`)
- `backend/config/config.js` (Added payment gateway and SMTP configuration keys)
- `backend/app.js` (Mounted `/api/payments` routes)
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts` (Integrated `'enrolments'` tab & `app-admin-enrolment`)
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.spec.ts` (Added `PaymentService` & `HttpClientTestingModule` mocks)
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts` (Integrated admission offer, checkout modal, permanent enrolment card & printable receipt)
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.spec.ts` (Added tests for admission confirmation, payment, and receipt)
- `frontend/src/app/app.routes.ts` (Registered route `/admin/enrolments`)
- `PROGRESS.md`

---

### 5. Test and Build Execution Results

#### Backend Test Suite (`npm --prefix backend test`)
- **Status:** PASSED (Exit code: 0)
- **Test Suites:** 16 passed, 16 total (15 baseline + 1 new suite `stage4-enrolment-payment.test.js`)
- **Total Tests:** 252 passed, 0 failed (229 baseline + 23 new tests)
  - `stage4-enrolment-payment.test.js` (23 tests) - ALL PASSED
    - Admission Confirmation Eligibility Engine (3 tests)
    - Payment Order Creation (3 tests)
    - Payment Verification & Permanent Enrolment (4 tests)
    - Applicant Admission Receipt (2 tests)
    - Gateway Webhook Endpoint (1 test)
    - Admin Payment Management, Reconciliation & Enrolment Directory (5 tests)
    - Role-Based Access Control (RBAC) Enforcement (5 tests)
  - All 15 existing test suites (`stage3-merit-allocation.test.js`, `stage2-document-verification.test.js`, `stage1-5-admin-config.test.js`, `programme-fee.test.js`, `session.test.js`, `application-programme.test.js`, `application.test.js`, `admin.test.js`, `document.test.js`, `auth.test.js`, `stage1.test.js`, `stage6.test.js`, `stage7.test.js`, `stage8.integration.test.js`, `stage8.replica.test.js`): ALL PASSED
- **Execution Time:** ~151.9 s

#### Frontend Unit Test Suite (`npm --prefix frontend test -- --watch=false`)
- **Status:** PASSED (Exit code: 0)
- **Test Files:** 29 passed, 29 total (27 baseline + 2 new suites)
- **Total Tests:** 156 passed, 0 failed (142 baseline + 14 new tests)
  - `payment.service.spec.ts` (7 tests) - ALL PASSED
  - `admin-enrolment.component.spec.ts` (4 tests) - ALL PASSED
  - `applicant-dashboard.component.spec.ts` (16 tests including 2 new Stage 4 tests) - ALL PASSED
  - All other 26 frontend suites (129 tests) - ALL PASSED
- **Execution Time:** ~12.67 s

#### Frontend Production Build (`npm --prefix frontend run build`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total:** 319.08 kB (raw) / 87.49 kB (estimated transfer)
- **Lazy Chunks:**
  - `applicant-dashboard-component`: 55.43 kB (raw) / 11.15 kB (transfer)
  - `admin-dashboard-component`: 53.40 kB (raw) / 10.64 kB (transfer)
  - All chunks compiled cleanly with zero syntax or bundle errors

---

## Upgrade Stage 4 Status: COMPLETED




---

## Upgrade Stage 5 — Reporting, Analytics and Data Export (CSV/PDF)
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
Stage 5 implements the centralized Institutional Reporting, Analytics, and Data Export subsystem for the IEM Online Admission Management System. It introduces multi-dimensional operational analytics covering all previous stages (Sessions, Programmes, Applications, Document Verification, Merit & Seat Allocation, Payments & Enrolment), a comprehensive administrative reporting dashboard with interactive visual charts, and a secure server-side export engine generating sanitized CSV spreadsheets (protected against formula injection) and professionally styled, multi-page A4 institutional PDF reports.

All reporting and data export capabilities are strictly guarded by Role-Based Access Control (RBAC), restricting access exclusively to users with the `admin` role (`authenticateToken` + `authorizeRoles('admin')`). Unauthorized attempts by reviewers or applicants receive HTTP 403 Forbidden.

---

### 2. Multi-Dimensional Operational Analytics & Metrics
The analytics service ([`backend/services/report.service.js`](file:///home/mhkxuz/mean-admission-system/backend/services/report.service.js)) implements comprehensive MongoDB aggregation pipelines with unified multi-dimensional filtering across:
- `academicSession` (Active, past, or specific session)
- `programmeId` (Specific academic programme)
- `status` (`Submitted`, `Under Review`, `Selected`, `Rejected`)
- `category` (`General`, `SC`, `ST`, `OBC`)
- `documentStatus` (`Pending`, `Verified`, `Rejected`)
- `paymentStatus` (`Successful`, `Pending`, `Failed`, `Cancelled`)
- `startDate` & `endDate` (Submission / transaction date ranges)

#### Analytics Subsystems:
1. **Executive Overview Analytics (`GET /api/admin/reports/overview`)**:
   - Aggregated KPIs: Total Applications, Status counts (`Selected`, `Rejected`, `Submitted`, `Under Review`), Document counts (`Total`, `Verified`, `Pending`, `Rejected`), Confirmed Enrolments, Processing Completion Rate.
   - **Verified Collected Revenue**: Aggregates monetary receipts exclusively from payment records where `status === 'Successful'`. Initiated, pending, failed, or cancelled transactions are strictly excluded to safeguard financial accounting integrity.
   - Monthly Activity Trends: Month-by-month submission volumes and verified fee revenue.

2. **Application Analytics (`GET /api/admin/reports/applications`)**:
   - Status Breakdown: Total counts and percentage distributions per workflow status.
   - Category-Wise Breakdown: Candidate volumes across General, SC, ST, and OBC admission quotas.
   - Programme Popularity: Total applications, applicant share, and demand distribution across academic offerings.
   - Session Distribution: Cross-session historical comparison.
   - Timeline Trends: Daily application submission trajectory over the selected date range.

3. **Document Verification Analytics (`GET /api/admin/reports/documents`)**:
   - Verification Health: Verified vs pending vs rejected counts and institutional verification completion percentage.
   - Document Type Distribution: Breakdown across Class 10 Marksheets, Class 12 Marksheets, Entrance Rank Cards, Photo IDs, and Category Certificates.
   - Reviewer Workload & Performance: Aggregation by `verifiedBy` auditing individual reviewer productivity and document throughput.
   - Outstanding Requirements: Real-time count of pending applications and unverified documents requiring reviewer attention.

4. **Merit List & Seat Allocation Analytics (`GET /api/admin/reports/merit`)**:
   - Screening Volume: Total merit lists generated, candidates screened, and seat allocations issued.
   - Cutoff Summaries: Category-wise minimum cutoff scores published across programmes and allocation rounds.
   - Seat Capacity & Utilization: Detailed per-programme audit of Total Seat Capacity vs Allocated Seats vs Confirmed Enrolments vs Waitlisted Candidates vs Vacant Seats, including seat utilization percentages and category quota breakdowns.

5. **Financial & Enrolment Analytics (`GET /api/admin/reports/payments`)**:
   - Verified Revenue Integrity: Accurate calculation of total collected funds strictly from `Successful` transactions.
   - Transaction Health: Breakdown across Successful, Pending, Failed, and Cancelled payment records.
   - Programme Collections: Enrolled candidate counts and fee collections grouped by degree programme.
   - Category Enrolments: Enrolment counts and fees collected per admission category quota.
   - Daily Revenue Trends: Daily transactional volume and monetary revenue timeline.
   - Financial Reconciliation Summary: Total transactions, successful vs pending vs failed reconciliation counts, and reconciliation match rate percentage.

---

### 3. Data Export Engine (CSV & PDF)
Implemented in [`backend/utils/report-export.util.js`](file:///home/mhkxuz/mean-admission-system/backend/utils/report-export.util.js):

#### A. CSV Export with Formula Injection Protection
- **Security Sanitization**: Any cell starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is safely escaped by prepending an apostrophe (`'`), neutralizing CSV/Excel Formula Injection (DDE) attacks when opened in Microsoft Excel, Google Sheets, or LibreOffice Calc.
- Standard RFC 4180 CSV generation with quote escaping and proper comma delimiters.
- Delivered with `Content-Type: text/csv` and descriptive attachment filenames (e.g., `iem-applications-report-1731290000.csv`).

#### B. Institutional PDF Report Generation
- **Pure Node.js Binary Generator**: Emits standard PDF 1.4 binary documents without relying on fragile external binary dependencies or network services.
- **IEM Branding**: Institutional dark navy header banner (`#002b49`), gold accents, institutional title ("INSTITUTE OF ENGINEERING & MANAGEMENT (IEM)"), report title, and generation timestamp.
- **Summary KPI Ribbon**: Executive metric boxes summarizing key figures for the dataset.
- **Auto-Paginated Data Tables**: A4 page geometry (595.28 x 841.89 pt), alternating row zebra striping, table headers, column text truncation, and automatic multi-page splitting.
- **Confidentiality Footers**: Official confidentiality notice, generated timestamp, and "Page X of Y" pagination numbering.
- Delivered with `Content-Type: application/pdf` and `Content-Disposition: attachment`.

#### Available Datasets:
| Dataset Key | Dataset Title | Description | Supported Formats |
| :--- | :--- | :--- | :--- |
| `applications` | Applications Report | Candidate details, percentages, entrance scores, dates, statuses | CSV, PDF |
| `applicants` | Applicants Directory | User registry, contact details, account dates, application counts | CSV, PDF |
| `documents` | Document Verification Report | Uploaded files, document types, verification statuses, reviewer audits | CSV, PDF |
| `merit` | Merit Lists & Scores | Candidate merit ranks, percentages, and category cutoffs | CSV, PDF |
| `allocations` | Seat Allocations | Allocation rounds, programmes, categories, seat numbers, deadlines | CSV, PDF |
| `payments` | Payment Transactions | Order IDs, transaction refs, gateways, amounts, statuses, timestamps | CSV, PDF |
| `enrolments` | Confirmed Enrolment Registry | Enrolment IDs, student names, programmes, categories, confirmed dates | CSV, PDF |
| `fee-summary` | Fee Collection Summary | Consolidated revenue audit by programme, enrolled counts, revenue | CSV, PDF |

---

### 4. APIs Introduced
All reporting and analytics endpoints mounted under `/api/admin/reports` (Guarded by `authenticateToken` + `authorizeRoles('admin')`):

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/reports/overview` | Admin | Multi-dimensional executive overview KPIs and monthly trends. |
| `GET` | `/api/admin/reports/applications` | Admin | Application status, category, programme, session, and timeline analytics. |
| `GET` | `/api/admin/reports/documents` | Admin | Document verification metrics, types, reviewer workloads, and outstanding items. |
| `GET` | `/api/admin/reports/merit` | Admin | Merit screening volume, published cutoffs, and programme seat utilization. |
| `GET` | `/api/admin/reports/payments` | Admin | Verified collected revenue, payment health breakdown, programme collections, and reconciliation. |
| `GET` | `/api/admin/reports/export/:type` | Admin | Streams sanitized CSV spreadsheet or branded PDF document (`?format=csv` or `?format=pdf`). |

---

### 5. Frontend Architecture & Administration UI
- **Report Models** ([`frontend/src/app/core/models/report.model.ts`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/core/models/report.model.ts)):
  - Defines TypeScript models for `OverviewAnalytics`, `ApplicationAnalytics`, `DocumentAnalytics`, `MeritAnalytics`, `PaymentAnalytics`, `ReportFilterParams`, and export types.
- **Report Service** ([`frontend/src/app/core/services/report.service.ts`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/core/services/report.service.ts)):
  - Communicates with reporting endpoints and implements `exportReport` blob streaming with `triggerDownload` browser download helper.
- **Admin Reports Component** ([`frontend/src/app/features/admin/reports/admin-reports.component.ts`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/features/admin/reports/admin-reports.component.ts)):
  - Unified multi-dimensional filter bar with dropdowns for Session, Programme, Status, Category, Document Status, Payment Status, and Date Range.
  - Top KPI Ribbon displaying Total Applications, Verified Documents (% meter), Confirmed Enrolments, Verified Revenue (INR ₹), and Processing Completion Rate.
  - Sub-tabbed navigation across 6 views:
    1. **Executive Overview**: KPI ribbon and monthly activity trends table with visual activity meters.
    2. **Application Analytics**: Status distribution bars, category distribution bars, and programme popularity table.
    3. **Verification Analytics**: Document verification KPI cards, type distribution bars, reviewer workload distribution table, and outstanding requirement warning banner.
    4. **Merit & Seat Allocations**: Screening metrics, published cutoff score table by programme and round, and seat capacity vs allocation vs vacancy utilization meters.
    5. **Financials & Enrolment**: Financial reconciliation match rate card, category enrolments table, and programme collections summary table.
    6. **Export Data Center**: 8 dataset download cards offering one-click CSV (formula sanitized) and PDF (IEM branded) downloads.
- **Admin Dashboard Integration** ([`frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts)):
  - Integrated `'reports'` tab into `activeTab` navigation and template pane `<app-admin-reports>`.
- **Router Configuration** ([`frontend/src/app/app.routes.ts`](file:///home/mhkxuz/mean-admission-system/frontend/src/app/app.routes.ts)):
  - Registered route `/admin/reports` with `[authGuard, adminGuard]`.

---

### 6. Files Created and Modified (Stage 5)

#### Files Created:
- `backend/utils/report-export.util.js`
- `backend/services/report.service.js`
- `backend/controllers/report.controller.js`
- `backend/routes/report.routes.js`
- `backend/tests/stage5-reporting-analytics.test.js`
- `frontend/src/app/core/models/report.model.ts`
- `frontend/src/app/core/services/report.service.ts`
- `frontend/src/app/core/services/report.service.spec.ts`
- `frontend/src/app/features/admin/reports/admin-reports.component.ts`
- `frontend/src/app/features/admin/reports/admin-reports.component.spec.ts`

#### Files Modified:
- `backend/app.js` (Mounted `/api/admin/reports` route)
- `frontend/src/app/app.routes.ts` (Registered route `/admin/reports`)
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.ts` (Integrated `'reports'` navigation tab & `app-admin-reports`)
- `frontend/src/app/features/admin/dashboard/admin-dashboard.component.spec.ts` (Added `ReportService` mock provider)
- `PROGRESS.md`

---

### 7. Test and Build Execution Results

#### Backend Test Suite (`npm --prefix backend test`)
- **Status:** PASSED (Exit code: 0)
- **Test Suites:** 17 passed, 17 total (16 baseline + 1 new suite `stage5-reporting-analytics.test.js`)
- **Total Tests:** 268 passed, 0 failed (252 baseline + 16 new tests)
  - `stage5-reporting-analytics.test.js` (16 tests) - ALL PASSED:
    - 1. Centralized Overview Analytics (2 tests)
    - 2. Application Analytics & Distributions (2 tests)
    - 3. Document Verification Analytics (1 test)
    - 4. Merit List & Seat Allocation Analytics (1 test)
    - 5. Payment & Enrolment Financial Analytics (1 test)
    - 6. CSV Export Functionality & Formula Injection Protection (3 tests)
    - 7. PDF Generation Functionality (2 tests)
    - 8. Role-Based Access Control (RBAC) Enforcement (4 tests)
  - All 16 existing test suites: ALL PASSED.
- **Execution Time:** ~118.0 s

#### Frontend Unit Test Suite (`npm --prefix frontend test -- --no-watch`)
- **Status:** PASSED (Exit code: 0)
- **Test Files:** 31 passed, 31 total (29 baseline + 2 new suites)
- **Total Tests:** 168 passed, 0 failed (156 baseline + 12 new tests)
  - `report.service.spec.ts` (8 tests) - ALL PASSED
  - `admin-reports.component.spec.ts` (4 tests) - ALL PASSED
  - All other 29 frontend test suites: ALL PASSED
- **Execution Time:** ~11.89 s

#### Frontend Production Build (`npm --prefix frontend run build`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total:** 319.19 kB (raw) / 87.48 kB (estimated transfer)
- **Output:** Clean bundle generated at `frontend/dist/frontend` with zero compiler errors.

---

## Upgrade Stage 5 Status: COMPLETED


---

## Upgrade Stage 6 — Final Functional Corrections
**Status:** Completed  
**Completion Date:** 2026-11-11

---

### 1. Summary of Changes
This stage implemented targeted logical and functional refinements identified during manual testing across four core modules:
1. **Academic Credentials Inputs**: Replaced free-text board and entrance examination fields with structured dropdowns (`CBSE`, `CISCE / ICSE`, `WBCHSE`, `Other State Board`, `NIOS`, `Other`) and dynamic custom inputs. Introduced structured entrance result type (`Rank`, `Percentile`, `Score`) with numeric-only validation, dynamic range constraints, unit labels, and backward-compatible score string synchronization. Updated backend merit normalization to handle Rank, Percentile, and Score without cross-type distortion.
2. **Programme Selection, Department Logic & Live Fee Structure**: Added startup auto-seeding of 6 default IEM academic programmes (`BTECH-CSE`, `BTECH-IT`, `BTECH-ECE`, `BCA`, `MCA`, `MBA`) with active session offerings, seat capacities, and active fee structures. Normalized search queries to handle punctuation/whitespace variations (`B.Tech` matching `BTECH-CSE`). Integrated live fee structure breakdown directly into programme selection cards with clear missing-fee warnings. Conditioned department selection strictly on engineering programmes (hiding department and removing validation for BCA, MCA, MBA).
3. **Complete Admission Journey & Sandbox Simulation**: Introduced a 9-step responsive visual admission progress tracker on the applicant dashboard reflecting real backend lifecycle stages (Submitted -> Under Review -> Documents Verified -> Merit & Seat Allocation Published -> Admission Offer Received -> Admission Fee Payment -> Payment Verified -> Final Admission Confirmed -> Permanent Enrolment Generated). Added admission offer cards with fee breakdown, pending allocation cards, and a 3-outcome sandbox payment simulator (Successful, Failed, Cancelled) strictly gated to sandbox environments.
4. **Password Visibility Toggles**: Implemented accessible eye/eye-off visibility toggles across Login password, Registration password & confirm password, and Admin Reviewer creation password without altering form state.

---

### 2. Files Modified and Created
- `backend/models/application.model.js` (Added `entranceResultType`, `entranceNumericScore`, relaxed `preferredDepartment` enum)
- `backend/validators/application.validator.js` (Added structured score validation, sync helper, conditional department validation)
- `backend/services/application.service.js` (Only set department for engineering degrees)
- `backend/services/merit.service.js` (Updated `normalizeEntranceScore` for Rank, Percentile, and Raw Score)
- `backend/services/programme.service.js` & `backend/server.js` (Auto-seed 6 default programmes and fee structures on boot)
- `backend/scripts/seed-programmes.js` (Standalone idempotent CLI seeding script)
- `backend/tests/functional-corrections.test.js` (New backend test suite verifying all 6 backend corrections)
- `package.json` (Added `"seed:programmes"` script)
- `frontend/src/app/core/models/application.model.ts` (Updated `AcademicInfo` and `AdmissionApplication` interfaces)
- `frontend/src/app/features/applicant/application-form/application-form.component.ts` (Board dropdowns, entrance exam dropdowns, structured score inputs, search normalization, live fee breakdown, conditional department logic)
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts` (9-step visual tracker, pending allocation card, 3-outcome sandbox payment simulation)
- `frontend/src/app/features/auth/login/login.component.ts` (Password visibility toggle)
- `frontend/src/app/features/auth/register/register.component.ts` (Password & confirm password visibility toggles)
- `frontend/src/app/features/admin/reviewers/admin-reviewers.component.ts` (Reviewer creation password visibility toggle)
- `frontend/src/app/features/applicant/functional-corrections.spec.ts` (New frontend unit test suite verifying all 4 areas)

---

### 3. Test and Build Execution Results

#### Backend Test Suite (`npm run test:backend`)
- **Status:** PASSED (Exit code: 0)
- **Test Suites:** 18 passed, 18 total (17 baseline + 1 new suite `functional-corrections.test.js`)
- **Total Tests:** 274 passed, 274 total (268 baseline + 6 new tests)
- **Execution Time:** ~100.24 s

#### Frontend Unit Test Suite (`npm run test:frontend`)
- **Status:** PASSED (Exit code: 0)
- **Test Files:** 32 passed, 32 total (31 baseline + 1 new suite `functional-corrections.spec.ts`)
- **Total Tests:** 178 passed, 178 total (168 baseline + 10 new tests)
- **Execution Time:** ~6.66 s

#### Frontend Production Build (`npm run build:frontend`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total:** 319.19 kB (raw) / 87.47 kB (estimated transfer)
- **Output:** Clean bundle generated at `frontend/dist/frontend` with zero compiler errors.


---

## Critical Integration Fix — Legacy Applications Missing from Merit Generation

**Date:** 2026-11-11

### 1. Root Cause

All 3 existing applications were created before programme auto-seeding existed, so their `selectedProgramme` field was `undefined`. The merit service queries `Application.find({ selectedProgramme: programmeId })`, which returned 0 results. The admin dashboard lists applications without filtering by `selectedProgramme`, which is why it found them.

**Mapping from existing records:**
| Applicant | Application ID | `preferredDepartment` | Mapped Programme |
|---|---|---|---|
| Samarpan Das | IEM-2026-93204 | Computer Science & Engineering | BTECH-CSE |
| Jyotismata Biswas | IEM-2026-57281 | Computer Science & Engineering | BTECH-CSE |
| Rahul Sharma | IEM-2026-46293 | Information Technology | BTECH-IT |

### 2. Files Created

- `backend/services/legacy-migration.service.js` — Auto-maps legacy applications to programmes via `preferredDepartment` match. Provides `migrateLegacyApplications()`, `adminAssignProgramme()`, `getUnmappedApplications()`.
- `backend/tests/e2e-admission-workflow.test.js` — End-to-end integration test (6 tests): legacy migration, merit generation discovery, full admission lifecycle, admin manual programme assignment.

### 3. Files Modified

- `backend/controllers/admin.controller.js` — Added `getUnmappedApplications`, `assignProgramme`, `migrateLegacyApplications` controller functions.
- `backend/routes/admin.routes.js` — Added 3 routes before `:id` param routes: `GET /applications/unmapped/programmes`, `POST /applications/migrate-legacy`, `PATCH /applications/:id/assign-programme`.
- `backend/server.js` — Calls `legacyMigration.migrateLegacyApplications()` on startup after programme seeding.
- `frontend/src/app/features/applicant/dashboard/applicant-dashboard.component.ts` — Added `trackerActionHint` getter with contextual per-step action guidance.

### 4. Migration Performed

Live database migration executed on startup. All 3 existing applications now have correct `selectedProgramme` references. Migration is idempotent — never overwrites existing `selectedProgramme` values.

### 5. Test and Build Results

#### E2E Integration Test (`e2e-admission-workflow.test.js`)
- **Status:** PASSED
- **Tests:** 6 passed, 6 total
- Covers: legacy migration, idempotency, merit discovery, full lifecycle (merit → allocation → payment → enrolment), admin manual assignment

#### Backend Test Suite (`npm run test:backend`)
- **Status:** PASSED (Exit code: 0)
- **Test Suites:** 19 passed, 19 total (18 previous + 1 new `e2e-admission-workflow.test.js`)
- **Total Tests:** 280 passed, 280 total

#### Frontend Unit Test Suite (`npm run test:frontend`)
- **Status:** PASSED (Exit code: 0)
- **Test Files:** 32 passed, 32 total
- **Total Tests:** 178 passed, 178 total

#### Frontend Production Build (`npm run build:frontend`)
- **Status:** PASSED (Exit code: 0)
- **Initial Total:** 319.19 kB (raw) / 87.47 kB (estimated transfer)
