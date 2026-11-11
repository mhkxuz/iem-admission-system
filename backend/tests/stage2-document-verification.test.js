const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const {
  User,
  Application,
  UploadedDocument,
  DocumentVerificationHistory,
  AcademicSession
} = require('../models');

let mongoServer;

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

function createDummyPdfBuffer() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await User.init();
  await Application.init();
  await UploadedDocument.init();
  await DocumentVerificationHistory.init();

  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await DocumentVerificationHistory.deleteMany({});
  await UploadedDocument.deleteMany({});
  await Application.deleteMany({});
  await User.deleteMany({});
  await AcademicSession.deleteMany({});
});

describe('Stage 2 — Document Verification Sub-Workflow & Reviewer Role', () => {
  let applicant, applicantToken;
  let applicant2, applicant2Token;
  let reviewer, reviewerToken;
  let admin, adminToken;
  let testApp, testDoc;

  beforeEach(async () => {
    // 1. Create Active Academic Session
    await AcademicSession.create({
      sessionName: '2026-2027',
      sessionCode: 'AY2026-27',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      applicationStartDate: new Date('2026-01-01'),
      applicationEndDate: new Date('2026-12-31'),
      isActive: true,
      status: 'Active'
    });

    // 2. Create Users
    applicant = await User.create({
      fullName: 'Rahul Roy',
      email: 'rahul@iem.edu',
      password: 'Password@123',
      role: 'applicant',
      phone: '9830112233'
    });
    applicantToken = generateTestToken(applicant);

    applicant2 = await User.create({
      fullName: 'Priya Sharma',
      email: 'priya@iem.edu',
      password: 'Password@123',
      role: 'applicant',
      phone: '9830112244'
    });
    applicant2Token = generateTestToken(applicant2);

    reviewer = await User.create({
      fullName: 'Dr. Reviewer Sen',
      email: 'reviewer@iem.edu',
      password: 'ReviewerPassword@123',
      role: 'reviewer',
      phone: '9830112255'
    });
    reviewerToken = generateTestToken(reviewer);

    admin = await User.create({
      fullName: 'Admin User',
      email: 'admin@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin',
      phone: '9830112266'
    });
    adminToken = generateTestToken(admin);

    // 3. Create Application
    testApp = await Application.create({
      applicationId: 'IEM-2026-10001',
      applicant: applicant._id,
      academicSession: '2026-2027',
      status: 'Submitted',
      personalInfo: {
        fullName: 'Rahul Roy',
        dob: new Date('2005-01-15'),
        gender: 'Male',
        email: 'rahul@iem.edu',
        phone: '9830112233',
        address: 'Salt Lake',
        city: 'Kolkata',
        state: 'West Bengal',
        pincode: '700091'
      },
      academicInfo: {
        class10Board: 'CBSE',
        class10Percentage: 90,
        class12Board: 'CBSE',
        class12Percentage: 92,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: '2500'
      },
      admissionInfo: {
        preferredDepartment: 'Computer Science & Engineering',
        admissionCategory: 'General'
      }
    });

    // 4. Create dummy file on disk & document record
    const dummyFileName = `test-doc-${Date.now()}.pdf`;
    const dummyFilePath = path.join(config.uploadDir, dummyFileName);
    fs.writeFileSync(dummyFilePath, createDummyPdfBuffer());

    testDoc = await UploadedDocument.create({
      application: testApp._id,
      applicant: applicant._id,
      documentType: 'Class 12 Marksheet',
      originalFileName: 'class12_marksheet.pdf',
      storedFileName: dummyFileName,
      filePath: path.relative(path.resolve(__dirname, '..'), dummyFilePath),
      mimeType: 'application/pdf',
      fileSize: 1024,
      verificationStatus: 'Pending'
    });
  });

  describe('1. Role-Based Access Control for Reviewer Role', () => {
    it('allows reviewer to access review queue (200 OK)', async () => {
      const res = await request(app)
        .get('/api/documents/queue')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]._id).toBe(testDoc._id.toString());
    });

    it('denies applicant from accessing review queue (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/documents/queue')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('denies unauthenticated request to review queue (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/documents/queue');
      expect(res.status).toBe(401);
    });

    it('denies reviewer from accessing administrator programme or session configuration (403 Forbidden)', async () => {
      const resProgramme = await request(app)
        .get('/api/admin/programmes')
        .set('Authorization', `Bearer ${reviewerToken}`);
      expect(resProgramme.status).toBe(403);

      const resSession = await request(app)
        .get('/api/admin/sessions')
        .set('Authorization', `Bearer ${reviewerToken}`);
      expect(resSession.status).toBe(403);
    });

    it('denies reviewer from modifying application admission status (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/admin/applications/${testApp._id}/status`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Under Review' });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Document Verification Workflow', () => {
    it('approves document when reviewer verifies it (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Verified', remarks: 'Marksheet verified against WBJEE database.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('Verified');
      expect(res.body.data.verificationRemarks).toBe('Marksheet verified against WBJEE database.');
      expect(res.body.data.verifiedBy._id).toBe(reviewer._id.toString());
      expect(res.body.data.verifiedAt).toBeTruthy();

      // Check DB persistence
      const updatedInDb = await UploadedDocument.findById(testDoc._id);
      expect(updatedInDb.verificationStatus).toBe('Verified');
      expect(updatedInDb.verifiedBy.toString()).toBe(reviewer._id.toString());

      // Check audit history record
      const history = await DocumentVerificationHistory.find({ document: testDoc._id });
      expect(history.length).toBe(1);
      expect(history[0].previousStatus).toBe('Pending');
      expect(history[0].newStatus).toBe('Verified');
      expect(history[0].verifiedBy.toString()).toBe(reviewer._id.toString());
      expect(history[0].remarks).toBe('Marksheet verified against WBJEE database.');
    });

    it('rejects document when reviewer provides mandatory remarks (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Rejected', remarks: 'Marksheet scan is blurry and unreadable.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('Rejected');
      expect(res.body.data.verificationRemarks).toBe('Marksheet scan is blurry and unreadable.');

      const history = await DocumentVerificationHistory.find({ document: testDoc._id });
      expect(history.length).toBe(1);
      expect(history[0].previousStatus).toBe('Pending');
      expect(history[0].newStatus).toBe('Rejected');
    });

    it('fails rejection with 400 when remarks are missing or empty', async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Rejected', remarks: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/remarks are mandatory/i);
    });

    it('fails verification with 400 on invalid status', async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Accepted' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid verification status/i);
    });

    it('fails verification with 400 on invalid document ID format', async () => {
      const res = await request(app)
        .patch('/api/documents/invalid-id/verify')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Verified' });

      expect(res.status).toBe(400);
    });

    it('fails verification with 404 when document does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/documents/${nonExistentId}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Verified' });

      expect(res.status).toBe(404);
    });

    it('denies applicant from verifying their own document (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ status: 'Verified' });

      expect(res.status).toBe(403);
    });

    it('allows admin to verify documents (200 OK)', async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Verified', remarks: 'Verified by Admissions Head' });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe('Verified');
      expect(res.body.data.verifiedBy._id).toBe(admin._id.toString());
    });
  });

  describe('3. Applicant Visibility & Document Replacement Flow', () => {
    it('returns document verification status and rejection remarks to applicant', async () => {
      // First reject the document
      await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Rejected', remarks: 'Roll number not visible in photo.' });

      // Applicant fetches documents
      const res = await request(app)
        .get(`/api/documents/application/${testApp._id}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].verificationStatus).toBe('Rejected');
      expect(res.body.data[0].verificationRemarks).toBe('Roll number not visible in photo.');
      expect(res.body.data[0].verifiedBy).toBeTruthy();
    });

    it('denies other applicants from viewing documents for this application (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/documents/application/${testApp._id}`)
        .set('Authorization', `Bearer ${applicant2Token}`);

      expect(res.status).toBe(403);
    });

    it('replaces a rejected document and sets new document status to Pending', async () => {
      // 1. Reject original document
      await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Rejected', remarks: 'Blurry scan.' });

      // 2. Applicant uploads replacement document
      const uploadRes = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${applicantToken}`)
        .field('applicationId', testApp._id.toString())
        .field('documentType', 'Class 12 Marksheet')
        .attach('document', createDummyPdfBuffer(), 'clean_marksheet.pdf');

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.data.verificationStatus).toBe('Pending');
      expect(uploadRes.body.data.originalFileName).toBe('clean_marksheet.pdf');

      // 3. Verify original document has replacedBy link and kept historical status
      const originalDoc = await UploadedDocument.findById(testDoc._id);
      expect(originalDoc.verificationStatus).toBe('Rejected');
      expect(originalDoc.replacedBy.toString()).toBe(uploadRes.body.data._id.toString());

      // 4. Verify review queue now shows both, with the new document pending
      const queueRes = await request(app)
        .get('/api/documents/queue')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(queueRes.status).toBe(200);
      expect(queueRes.body.data.length).toBe(2);
    });
  });

  describe('4. Administrative Role Management for Reviewers', () => {
    it('allows admin to list users with role filter', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=reviewer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('reviewer@iem.edu');
    });

    it('allows admin to promote applicant to reviewer', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${applicant._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'reviewer' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('reviewer');

      const updatedUser = await User.findById(applicant._id);
      expect(updatedUser.role).toBe('reviewer');
    });

    it('allows admin to revoke reviewer back to applicant', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${reviewer._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'applicant' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('applicant');

      const updatedUser = await User.findById(reviewer._id);
      expect(updatedUser.role).toBe('applicant');
    });

    it('prevents administrator from demoting their own account (400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${admin._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'applicant' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot demote their own account/i);
    });

    it('allows admin to create a new reviewer directly', async () => {
      const res = await request(app)
        .post('/api/admin/users/reviewer')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Prof. Anirban Roy',
          email: 'anirban@iem.edu',
          password: 'Password@123',
          phone: '9830998877'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('reviewer');
      expect(res.body.data.email).toBe('anirban@iem.edu');
    });
  });

  describe('5. Backward Compatibility & Verification History', () => {
    it('resolves documents created without verification fields safely to Pending', async () => {
      // Simulate historical document created before Stage 2
      const historicalDoc = await UploadedDocument.collection.insertOne({
        application: testApp._id,
        applicant: applicant._id,
        documentType: 'Photograph',
        originalFileName: 'photo_old.jpg',
        storedFileName: 'photo_old.jpg',
        filePath: 'uploads/documents/photo_old.jpg',
        mimeType: 'image/jpeg',
        fileSize: 2048,
        uploadedAt: new Date()
      });

      const loadedDoc = await UploadedDocument.findById(historicalDoc.insertedId);
      expect(loadedDoc.verificationStatus).toBe('Pending');
      expect(loadedDoc.verificationRemarks).toBe('');
      expect(loadedDoc.verifiedBy).toBeNull();
    });

    it('retrieves verification history audit records for a document', async () => {
      // 1. Verify
      await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'Verified', remarks: 'First pass OK' });

      // 2. Reject in second inspection
      await request(app)
        .patch(`/api/documents/${testDoc._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Rejected', remarks: 'Re-inspected: board stamp missing' });

      // 3. Fetch history
      const historyRes = await request(app)
        .get(`/api/documents/${testDoc._id}/history`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.length).toBe(2);
      expect(historyRes.body.data[0].newStatus).toBe('Rejected');
      expect(historyRes.body.data[1].newStatus).toBe('Verified');
    });
  });
});
