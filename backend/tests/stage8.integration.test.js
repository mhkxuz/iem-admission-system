const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const adminService = require('../services/admin.service');
const {
  User,
  Application,
  UploadedDocument,
  ApplicationStatusHistory
} = require('../models');

let mongoServer;
let sequence = 0;
const uploadedFiles = [];

function createDummyPdfBuffer() {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF'
  );
}

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

function validSubmissionPayload(fullName, email, overrides = {}) {
  return {
    academicSession: '2026-2027',
    personalInfo: {
      fullName,
      dob: '2005-04-12',
      gender: 'Male',
      email,
      phone: '9830123456',
      address: 'Plot No. 12, Salt Lake Sector V',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '700091'
    },
    academicInfo: {
      class10Board: 'ICSE',
      class10Percentage: 91.5,
      class12Board: 'ISC',
      class12Percentage: 93.2,
      class12PassingYear: 2024,
      entranceExamName: 'WBJEE',
      entranceExamScore: 'Rank 1520'
    },
    admissionInfo: {
      preferredDepartment: 'Information Technology',
      admissionCategory: 'General'
    },
    ...overrides
  };
}

async function registerApplicant(overrides = {}) {
  sequence += 1;
  const email = overrides.email || `stage8.applicant.${sequence}@example.com`;
  const payload = {
    fullName: overrides.fullName || `Stage Eight Applicant ${sequence}`,
    email,
    password: 'Password@123',
    phone: '9830000001'
  };

  const response = await request(app).post('/api/auth/register').send(payload);
  return { response, email, password: payload.password, payload };
}

async function login(email, password) {
  return request(app).post('/api/auth/login').send({ email, password });
}

async function createAdmin(email = 'stage8.admin@iem.edu') {
  return User.create({
    fullName: 'Stage Eight Administrator',
    email,
    password: 'AdminPassword@123',
    role: 'admin'
  });
}

async function submitApplication(token, fullName, email, overrides = {}) {
  return request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send(validSubmissionPayload(fullName, email, overrides));
}

async function uploadPdf(token, applicationId, documentType = 'Class 12 Marksheet') {
  const response = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', `Bearer ${token}`)
    .field('applicationId', applicationId)
    .field('documentType', documentType)
    .attach('document', createDummyPdfBuffer(), 'stage8-marksheet.pdf');

  if (response.body.data && response.body.data.storedFileName) {
    uploadedFiles.push(
      path.resolve(config.uploadDir, response.body.data.storedFileName)
    );
  }

  return response;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await User.init();
  await Application.init();
  await UploadedDocument.init();
  await ApplicationStatusHistory.init();

  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }
});

afterAll(async () => {
  for (const filePath of uploadedFiles) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ApplicationStatusHistory.deleteMany({});
  await UploadedDocument.deleteMany({});
  await Application.deleteMany({});
  await User.deleteMany({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Stage 8: end-to-end applicant workflow', () => {
  it('should complete registration, login, submission, document upload, retrieval and re-login', async () => {
    // 1. Health endpoint and database connectivity
    const health = await request(app).get('/api/health');
    expect(health.statusCode).toBe(200);
    expect(health.body.data.status).toBe('healthy');
    expect(health.body.data.database).toBe('connected');

    // 2. Registration, forced applicant role and password hygiene
    const { response: registration, email, password, payload } = await registerApplicant();
    expect(registration.statusCode).toBe(201);
    expect(registration.body.data.token).toBeTruthy();
    expect(registration.body.data.user.role).toBe('applicant');
    expect(registration.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(registration.body.data.user)).not.toContain('$2');

    const storedUser = await User.findById(registration.body.data.user._id).select('+password');
    expect(storedUser.password).not.toBe(password);
    expect(await storedUser.comparePassword(password)).toBe(true);

    // Attempted client-side privilege escalation is ignored
    const escalation = await request(app).post('/api/auth/register').send({
      fullName: 'Escalation Attempt',
      email: 'stage8.escalation@example.com',
      password: 'Password@123',
      role: 'admin'
    });
    expect(escalation.statusCode).toBe(201);
    expect(escalation.body.data.user.role).toBe('applicant');

    const duplicateRegistration = await request(app).post('/api/auth/register').send({
      fullName: 'Duplicate Registration',
      email,
      password: 'Password@123'
    });
    expect(duplicateRegistration.statusCode).toBe(409);
    expect(duplicateRegistration.body.message).toContain('already exists');

    // 3. Login and empty dashboard
    const loginResponse = await login(email, password);
    expect(loginResponse.statusCode).toBe(200);
    const token = loginResponse.body.data.token;
    expect(loginResponse.body.data.user.password).toBeUndefined();

    const emptyDashboard = await request(app)
      .get('/api/applications/my-application')
      .set(auth(token));
    expect(emptyDashboard.statusCode).toBe(200);
    expect(emptyDashboard.body.data).toBeNull();

    // 4. Application submission with server-controlled status and identity
    const submission = await submitApplication(
      token,
      payload.fullName,
      email,
      {
        status: 'Selected',
        applicant: registration.body.data.user._id,
        applicationId: 'IEM-2026-00001'
      }
    );

    expect(submission.statusCode).toBe(201);
    expect(submission.body.data.status).toBe('Submitted');
    expect(submission.body.data.applicant).toBe(registration.body.data.user._id);
    expect(submission.body.data.applicationId).toMatch(/^IEM-2026-[A-Z0-9]{5}$/);

    const applicationId = submission.body.data.applicationId;
    const mongoId = submission.body.data._id;

    const initialHistory = await ApplicationStatusHistory.find({
      application: mongoId
    });
    expect(initialHistory).toHaveLength(1);
    expect(initialHistory[0].previousStatus).toBe('Submitted');
    expect(initialHistory[0].newStatus).toBe('Submitted');
    expect(initialHistory[0].changedBy.toString()).toBe(
      registration.body.data.user._id
    );

    const duplicateSubmission = await submitApplication(
      token,
      payload.fullName,
      email
    );
    expect(duplicateSubmission.statusCode).toBe(409);
    expect(duplicateSubmission.body.message).toContain('already submitted');

    // 5. Document upload, listing, inline view and download
    const upload = await uploadPdf(token, mongoId);
    expect(upload.statusCode).toBe(201);
    expect(upload.body.data.application).toBe(mongoId);
    expect(upload.body.data.applicant).toBe(registration.body.data.user._id);
    expect(upload.body.data.mimeType).toBe('application/pdf');
    expect(upload.body.data.originalFileName).toBe('stage8-marksheet.pdf');
    expect(upload.body.data.fileSize).toBeGreaterThan(0);

    const storedPath = path.resolve(config.uploadDir, upload.body.data.storedFileName);
    expect(fs.existsSync(storedPath)).toBe(true);

    const documentList = await request(app)
      .get(`/api/documents/application/${mongoId}`)
      .set(auth(token));
    expect(documentList.statusCode).toBe(200);
    expect(documentList.body.data).toHaveLength(1);

    const view = await request(app)
      .get(`/api/documents/${upload.body.data._id}/view`)
      .set(auth(token));
    expect(view.statusCode).toBe(200);
    expect(view.headers['content-type']).toContain('application/pdf');
    expect(view.headers['x-content-type-options']).toBe('nosniff');

    const download = await request(app)
      .get(`/api/documents/${upload.body.data._id}/download`)
      .set(auth(token));
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment');

    // 6. Log out / log back in and verify persistence
    const secondLogin = await login(email, password);
    expect(secondLogin.statusCode).toBe(200);
    const secondToken = secondLogin.body.data.token;

    const persisted = await request(app)
      .get('/api/applications/my-application')
      .set(auth(secondToken));
    expect(persisted.statusCode).toBe(200);
    expect(persisted.body.data.applicationId).toBe(applicationId);
    expect(persisted.body.data.status).toBe('Submitted');
    expect(persisted.body.data.documents).toHaveLength(1);
    expect(persisted.body.data.statusHistory).toHaveLength(1);

    const profile = await request(app).get('/api/auth/me').set(auth(secondToken));
    expect(profile.statusCode).toBe(200);
    expect(profile.body.data.password).toBeUndefined();

    const byId = await request(app)
      .get(`/api/applications/${mongoId}`)
      .set(auth(secondToken));
    expect(byId.statusCode).toBe(200);
    expect(byId.body.data.applicationId).toBe(applicationId);
  });
});

describe('Stage 8: end-to-end administrator workflow', () => {
  it('should list, inspect, transition and audit an application, then expose the new status to the applicant', async () => {
    const { response: registration, email, password, payload } = await registerApplicant();
    const applicantToken = registration.body.data.token;
    const applicantId = registration.body.data.user._id;

    const submission = await submitApplication(applicantToken, payload.fullName, email);
    const applicationMongoId = submission.body.data._id;
    const applicationId = submission.body.data.applicationId;

    const upload = await uploadPdf(applicantToken, applicationMongoId);
    expect(upload.statusCode).toBe(201);

    const admin = await createAdmin();
    const adminLogin = await login(admin.email, 'AdminPassword@123');
    expect(adminLogin.statusCode).toBe(200);
    const adminToken = adminLogin.body.data.token;

    // Dashboard aggregation
    const dashboard = await request(app).get('/api/admin/dashboard').set(auth(adminToken));
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.body.data.metrics.totalApplications).toBe(1);
    expect(dashboard.body.data.metrics.submitted).toBe(1);
    expect(dashboard.body.data.departmentDistribution).toEqual([
      { department: 'Information Technology', count: 1 }
    ]);

    // Listing and search
    const list = await request(app).get('/api/admin/applications').set(auth(adminToken));
    expect(list.statusCode).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.totalRecords).toBe(1);

    const searchByName = await request(app)
      .get('/api/admin/applications')
      .query({ search: 'Stage Eight Applicant' })
      .set(auth(adminToken));
    expect(searchByName.body.data).toHaveLength(1);

    const searchById = await request(app)
      .get('/api/admin/applications')
      .query({ search: applicationId })
      .set(auth(adminToken));
    expect(searchById.body.data).toHaveLength(1);

    // Filters, sort and pagination
    const filtered = await request(app)
      .get('/api/admin/applications')
      .query({
        department: 'Information Technology',
        category: 'General',
        status: 'Submitted',
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10
      })
      .set(auth(adminToken));
    expect(filtered.statusCode).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.meta.page).toBe(1);

    // Detailed inspection including uploaded documents
    const details = await request(app)
      .get(`/api/admin/applications/${applicationMongoId}`)
      .set(auth(adminToken));
    expect(details.statusCode).toBe(200);
    expect(details.body.data.documents).toHaveLength(1);
    expect(details.body.data.statusHistory).toHaveLength(1);
    expect(details.body.data.allowedNextStatuses).toEqual(['Under Review']);

    const adminView = await request(app)
      .get(`/api/documents/${upload.body.data._id}/view`)
      .set(auth(adminToken));
    expect(adminView.statusCode).toBe(200);

    // Submitted -> Under Review
    const underReview = await request(app)
      .patch(`/api/admin/applications/${applicationMongoId}/status`)
      .set(auth(adminToken))
      .send({
        status: 'Under Review',
        remarks: 'Academic documents verified.',
        changedBy: applicantId,
        previousStatus: 'Selected'
      });
    expect(underReview.statusCode).toBe(200);
    expect(underReview.body.data.previousStatus).toBe('Submitted');
    expect(underReview.body.data.newStatus).toBe('Under Review');
    expect(underReview.body.data.application.status).toBe('Under Review');

    // Under Review -> Selected
    const selected = await request(app)
      .patch(`/api/admin/applications/${applicationMongoId}/status`)
      .set(auth(adminToken))
      .send({ status: 'Selected', remarks: 'Merit listed.' });
    expect(selected.statusCode).toBe(200);
    expect(selected.body.data.application.status).toBe('Selected');
    expect(selected.body.data.allowedNextStatuses).toEqual([]);

    // Terminal state cannot change
    const invalid = await request(app)
      .patch(`/api/admin/applications/${applicationMongoId}/status`)
      .set(auth(adminToken))
      .send({ status: 'Rejected' });
    expect(invalid.statusCode).toBe(400);

    // Audit trail contains initial submission plus exactly two admin transitions
    const history = await ApplicationStatusHistory.find({ application: applicationMongoId })
      .sort({ timestamp: 1, createdAt: 1 })
      .populate('changedBy', 'role');
    expect(history).toHaveLength(3);
    expect(history.map(entry => entry.previousStatus)).toEqual([
      'Submitted',
      'Submitted',
      'Under Review'
    ]);
    expect(history.map(entry => entry.newStatus)).toEqual([
      'Submitted',
      'Under Review',
      'Selected'
    ]);
    expect(history[0].changedBy.role).toBe('applicant');
    expect(history[1].changedBy.role).toBe('admin');
    expect(history[2].changedBy.role).toBe('admin');

    // Applicant sees the updated status and history on the next dashboard load
    const applicantDashboard = await request(app)
      .get('/api/applications/my-application')
      .set(auth(applicantToken));
    expect(applicantDashboard.statusCode).toBe(200);
    expect(applicantDashboard.body.data.status).toBe('Selected');
    expect(applicantDashboard.body.data.statusHistory).toHaveLength(3);

    // Dashboard statistics follow the status change
    const updatedDashboard = await request(app)
      .get('/api/admin/dashboard')
      .set(auth(adminToken));
    expect(updatedDashboard.body.data.metrics.submitted).toBe(0);
    expect(updatedDashboard.body.data.metrics.selected).toBe(1);
  });
});

describe('Stage 8: security and data isolation', () => {
  it('should block applicants from administrator endpoints and cross-applicant resources', async () => {
    const owner = await registerApplicant();
    const ownerToken = owner.response.body.data.token;
    const ownerId = owner.response.body.data.user._id;

    const submission = await submitApplication(
      ownerToken,
      owner.payload.fullName,
      owner.email
    );
    const application = submission.body.data;
    const upload = await uploadPdf(ownerToken, application._id);

    const intruder = await registerApplicant();
    const intruderToken = intruder.response.body.data.token;
    const intruderSubmission = await submitApplication(
      intruderToken,
      intruder.payload.fullName,
      intruder.email
    );
    const intruderApplication = intruderSubmission.body.data;

    // Admin-only endpoints
    for (const endpoint of [
      '/api/admin/dashboard',
      '/api/admin/applications'
    ]) {
      const response = await request(app).get(endpoint).set(auth(ownerToken));
      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
    }

    const statusUpdate = await request(app)
      .patch(`/api/admin/applications/${application._id}/status`)
      .set(auth(ownerToken))
      .send({ status: 'Under Review' });
    expect(statusUpdate.statusCode).toBe(403);

    // Cross-applicant application IDOR
    const crossApplication = await request(app)
      .get(`/api/applications/${application._id}`)
      .set(auth(intruderToken));
    expect(crossApplication.statusCode).toBe(403);
    expect(crossApplication.body.message).toContain('Forbidden');

    // Cross-applicant document IDOR
    const crossDocumentView = await request(app)
      .get(`/api/documents/${upload.body.data._id}/view`)
      .set(auth(intruderToken));
    expect(crossDocumentView.statusCode).toBe(403);

    const crossDocumentList = await request(app)
      .get(`/api/documents/application/${application._id}`)
      .set(auth(intruderToken));
    expect(crossDocumentList.statusCode).toBe(403);

    const crossUpload = await uploadPdf(intruderToken, application._id);
    expect(crossUpload.statusCode).toBe(403);

    // Ownership and identity are unaffected by denied attempts
    const databaseApplication = await Application.findById(application._id);
    expect(databaseApplication.status).toBe('Submitted');
    expect(databaseApplication.applicant.toString()).toBe(ownerId);

    // Unauthenticated access is rejected before authorization
    const unauthenticated = await request(app).get('/api/admin/dashboard');
    expect(unauthenticated.statusCode).toBe(401);

    // The intruder can still access their own application
    const ownApplication = await request(app)
      .get(`/api/applications/${intruderApplication._id}`)
      .set(auth(intruderToken));
    expect(ownApplication.statusCode).toBe(200);

    // Client-supplied status cannot be set through submission
    expect(intruderApplication.status).toBe('Submitted');
  });

  it('should hide internal failure details from unexpected 500 responses', async () => {
    const admin = await createAdmin('stage8.error.admin@iem.edu');
    const token = generateTestToken(admin);

    jest
      .spyOn(adminService, 'getDashboardOverview')
      .mockRejectedValueOnce(
        new Error('Sensitive database credentials: mongodb://secret')
      );

    const response = await request(app)
      .get('/api/admin/dashboard')
      .set(auth(token));

    expect(response.statusCode).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Internal Server Error');
    expect(JSON.stringify(response.body)).not.toContain('Sensitive database credentials');
  });

  it('should roll back a newly created application when initial audit history fails', async () => {
    const applicant = await registerApplicant();
    const token = applicant.response.body.data.token;

    jest
      .spyOn(ApplicationStatusHistory, 'create')
      .mockRejectedValueOnce(new Error('Simulated audit history failure'));

    const submission = await submitApplication(
      token,
      applicant.payload.fullName,
      applicant.email
    );

    expect(submission.statusCode).toBe(500);
    expect(submission.body.message).toBe('Internal Server Error');
    expect(await Application.countDocuments()).toBe(0);
    expect(await ApplicationStatusHistory.countDocuments()).toBe(0);
  });
});
