# Initial Project Audit — IEM Admission Management System Upgrade

We are continuing development of an EXISTING MEAN stack project: the IEM Online Admission Management System.

The project has already undergone nine development stages, followed by an IEM branding update. Significant functionality has already been implemented and tested.

We are now planning a major upgrade, divided into exactly five additional development stages.

The complete requirements are documented in:

`PROJECT_SPEC.md`

## MOST IMPORTANT INSTRUCTION

**DO NOT START IMPLEMENTING ANYTHING YET.**

This task is strictly an inspection, audit and planning exercise.

We are building on top of the existing application. We are NOT starting from scratch, replacing the backend, rewriting the frontend or rebuilding existing functionality.

## 1. Inspect the existing project

Thoroughly inspect the existing codebase, including:

- Backend architecture and dependencies.
- Frontend architecture and dependencies.
- MongoDB models and relationships.
- API routes, controllers, services and middleware.
- Authentication, JWT and RBAC.
- Applicant registration and login.
- Applicant profile and application submission.
- Document uploads, storage and retrieval.
- Administrator dashboard and applicant management.
- Application status workflow and audit history.
- Existing dashboard aggregations.
- Existing frontend pages, routing and components.
- Existing tests and test configuration.
- README, environment examples and project configuration.

Inspect the actual implementation rather than relying on previous agent reports.

## 2. Establish the current working baseline

Run the existing relevant:

- Backend tests.
- Frontend tests.
- Backend build/check commands, if applicable.
- Frontend production build.

Record the actual commands, results, failures and warnings.

Do not modify code merely to make a test pass during this audit.

If an existing test or build fails, document the failure.

## 3. Compare the existing implementation with PROJECT_SPEC.md

For every major feature in the specification, classify its current implementation as:

- COMPLETE — already implemented and verified.
- PARTIAL — implemented but missing important functionality.
- MISSING — not implemented.
- NEEDS VERIFICATION — code exists but its actual behaviour has not been verified.

Pay particular attention to functionality that was already delivered in the original nine stages.

Do not propose rebuilding features that already work.

## 4. Identify reusable existing functionality

Explicitly identify:

- Existing database models that can be extended.
- Existing APIs that can be reused.
- Existing frontend components that can be extended.
- Existing authentication and authorization mechanisms.
- Existing upload and document verification functionality.
- Existing application status and history implementation.
- Existing tests that should be preserved.
- Existing utilities and services that can support the new features.

## 5. Identify database changes

Compare the current MongoDB schema with the target database architecture in PROJECT_SPEC.md.

Report:

- Models that already exist.
- Models that need additional fields.
- Models that need extensions or relationships.
- New models that are genuinely required.
- Required indexes and uniqueness constraints.
- Potential migration requirements.
- Risks to existing applicant and application data.

Do not create or modify any models during this audit.

## 6. Produce a five-stage implementation plan

Use the five stages already defined in PROJECT_SPEC.md.

For each stage, report:

1. Features already available and reusable.
2. Features requiring modification.
3. Features requiring new implementation.
4. Backend changes.
5. Frontend changes.
6. Database changes.
7. Required tests.
8. Dependencies on earlier work.
9. Potential risks.

The purpose is to avoid unnecessary work and reduce development time.

## 7. Preserve the existing project

These restrictions are mandatory:

- Do not modify any source files.
- Do not create new application features.
- Do not delete or rename files.
- Do not reset or modify the MongoDB database.
- Do not delete applicant records or uploaded documents.
- Do not change existing environment configuration.
- Do not install or remove dependencies.
- Do not rewrite existing code.
- Do not replace working implementations.
- Do not create a new project.

You may execute read-only inspection commands and existing tests/build commands.

## 8. Final audit report

Provide a structured report containing:

A. Existing project architecture.

B. Verified functionality from the original development stages.

C. Feature-by-feature comparison against PROJECT_SPEC.md.

D. Existing database models and proposed changes.

E. Existing APIs and reusable frontend components.

F. Current test and build baseline.

G. Missing, incomplete and unverified functionality.

H. Revised implementation plan for the five upgrade stages.

I. Recommended order of implementation and dependencies.

J. Risks, compatibility concerns and data migration requirements.

K. A clear list of what must NOT be rebuilt because it already exists.

## Final instruction

Do not begin Stage 1 implementation after completing the audit.

Stop and present the report for review.

We will review the audit together, finalize any necessary adjustments and only then begin the first upgrade stage.