const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const { User, Application, UploadedDocument } = require('../models');

let mongoServer;

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

// Generate minimal valid PDF buffer
function createDummyPdfBuffer() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
}

// Generate minimal valid JPEG buffer
function createDummyJpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
}

// Generate minimal valid PNG buffer
function createDummyPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89
  ]);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await User.init();
  await Application.init();
  await UploadedDocument.init();

  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await UploadedDocument.deleteMany({});
  await Application.deleteMany({});
  await User.deleteMany({});
});

describe('Stage 4: Multer Document Upload and Secure Document Access API', () => {
  let applicant1, token1, app1;
  let applicant2, token2, app2;
  let adminUser, adminToken;

  beforeEach(async () => {
    applicant1 = await User.create({
      fullName: 'Siddhartha Sen',
      email: 'siddhartha@iem.edu',
      password: 'Password@123',
      role: 'applicant',
      phone: '9830112233'
    });
    token1 = generateTestToken(applicant1);

    app1 = await Application.create({
      applicationId: 'IEM-2026-10001',
      applicant: applicant1._id,
      academicSession: '2026-2027',
      personalInfo: {
        fullName: 'Siddhartha Sen',
        dob: new Date('2005-02-10'),
        gender: 'Male',
        email: 'siddhartha@iem.edu',
        phone: '9830112233',
        address: 'Salt Lake',
        state: 'WB',
        city: 'Kolkata',
        pincode: '700091'
      },
      academicInfo: {
        class10Board: 'CBSE',
        class10Percentage: 92,
        class12Board: 'CBSE',
        class12Percentage: 94,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: '890'
      },
      admissionInfo: {
        preferredDepartment: 'Computer Science & Engineering',
        admissionCategory: 'General'
      }
    });

    applicant2 = await User.create({
      fullName: 'Ananya Roy',
      email: 'ananya@iem.edu',
      password: 'Password@123',
      role: 'applicant',
      phone: '9830445566'
    });
    token2 = generateTestToken(applicant2);

    app2 = await Application.create({
      applicationId: 'IEM-2026-20002',
      applicant: applicant2._id,
      academicSession: '2026-2027',
      personalInfo: {
        fullName: 'Ananya Roy',
        dob: new Date('2005-06-15'),
        gender: 'Female',
        email: 'ananya@iem.edu',
        phone: '9830445566',
        address: 'New Town',
        state: 'WB',
        city: 'Kolkata',
        pincode: '700156'
      },
      academicInfo: {
        class10Board: 'ICSE',
        class10Percentage: 90,
        class12Board: 'ISC',
        class12Percentage: 91,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: '1200'
      },
      admissionInfo: {
        preferredDepartment: 'Information Technology',
        admissionCategory: 'General'
      }
    });

    adminUser = await User.create({
      fullName: 'Dean of Admissions',
      email: 'dean@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser);
  });

  describe('POST /api/documents/upload', () => {
    it('should successfully upload a genuine PDF document', async () => {
      const pdfBuffer = createDummyPdfBuffer();

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1._id.toString())
        .field('documentType', 'Class 12 Marksheet')
        .attach('document', pdfBuffer, 'class12_marksheet.pdf');

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentType).toBe('Class 12 Marksheet');
      expect(res.body.data.originalFileName).toBe('class12_marksheet.pdf');
      expect(res.body.data.mimeType).toBe('application/pdf');
      expect(res.body.data.storedFileName).toMatch(/^doc_\d+_[a-f0-9]+\.pdf$/);

      // Verify file exists on disk
      const filePathOnDisk = path.resolve(config.uploadDir, res.body.data.storedFileName);
      expect(fs.existsSync(filePathOnDisk)).toBe(true);

      // Clean up test file
      fs.unlinkSync(filePathOnDisk);
    });

    it('should successfully upload a genuine JPEG image document', async () => {
      const jpegBuffer = createDummyJpegBuffer();

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1.applicationId) // Supports custom application ID string
        .field('documentType', 'Photograph')
        .attach('document', jpegBuffer, 'passport_photo.jpg');

      expect(res.statusCode).toBe(201);
      expect(res.body.data.documentType).toBe('Photograph');
      expect(res.body.data.mimeType).toBe('image/jpeg');

      const filePath = path.resolve(config.uploadDir, res.body.data.storedFileName);
      expect(fs.existsSync(filePath)).toBe(true);
      fs.unlinkSync(filePath);
    });

    it('should successfully upload a genuine PNG image document', async () => {
      const pngBuffer = createDummyPngBuffer();

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1._id.toString())
        .field('documentType', 'Entrance Examination Scorecard')
        .attach('document', pngBuffer, 'wbjee_rankcard.png');

      expect(res.statusCode).toBe(201);
      expect(res.body.data.mimeType).toBe('image/png');

      const filePath = path.resolve(config.uploadDir, res.body.data.storedFileName);
      fs.unlinkSync(filePath);
    });

    it('should reject file with unsupported extension (.txt, .exe, .sh)', async () => {
      const textBuffer = Buffer.from('Fake document content');

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1._id.toString())
        .field('documentType', 'Class 10 Marksheet')
        .attach('document', textBuffer, 'malicious.exe');

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid file extension');
    });

    it('should reject file when MIME/signature check fails (fake PDF containing text)', async () => {
      const fakePdfContent = Buffer.from('Plain text file masquerading with .pdf extension');
      const filesBefore = fs.readdirSync(config.uploadDir).length;

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1._id.toString())
        .field('documentType', 'Class 10 Marksheet')
        .attach('document', fakePdfContent, 'fake_scorecard.pdf');

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Security verification failed');

      // Verify orphaned file cleanup
      const filesAfter = fs.readdirSync(config.uploadDir).length;
      expect(filesAfter).toBe(filesBefore);
    });

    it('should reject upload when no file is attached', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1._id.toString())
        .field('documentType', 'Class 10 Marksheet');

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No document file was provided');
    });

    it('should reject upload when documentType is invalid', async () => {
      const pdfBuffer = createDummyPdfBuffer();

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1._id.toString())
        .field('documentType', 'InvalidDocumentCategory')
        .attach('document', pdfBuffer, 'doc.pdf');

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid document type');
    });

    it('should forbid Applicant 2 from uploading against Applicant 1\'s application (403)', async () => {
      const pdfBuffer = createDummyPdfBuffer();
      const filesBefore = fs.readdirSync(config.uploadDir).length;

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token2}`) // Applicant 2
        .field('applicationId', app1._id.toString()) // Applicant 1's app
        .field('documentType', 'Class 10 Marksheet')
        .attach('document', pdfBuffer, 'marksheet.pdf');

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');

      // Ensure failed attempt unlinks file immediately
      const filesAfter = fs.readdirSync(config.uploadDir).length;
      expect(filesAfter).toBe(filesBefore);
    });

    it('should reject unauthenticated upload requests (401)', async () => {
      const pdfBuffer = createDummyPdfBuffer();

      const res = await request(app)
        .post('/api/documents/upload')
        .field('applicationId', app1._id.toString())
        .field('documentType', 'Class 10 Marksheet')
        .attach('document', pdfBuffer, 'doc.pdf');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Secure Document Retrieval (GET /api/documents/:id/view and /download)', () => {
    let uploadedDoc, createdFilePath;

    beforeEach(async () => {
      const pdfBuffer = createDummyPdfBuffer();
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1._id.toString())
        .field('documentType', 'Class 12 Marksheet')
        .attach('document', pdfBuffer, 'my_marksheet.pdf');

      uploadedDoc = res.body.data;
      createdFilePath = path.resolve(config.uploadDir, uploadedDoc.storedFileName);
    });

    afterEach(() => {
      if (fs.existsSync(createdFilePath)) {
        fs.unlinkSync(createdFilePath);
      }
    });

    it('should allow document owner (Applicant 1) to view their document inline', async () => {
      const res = await request(app)
        .get(`/api/documents/${uploadedDoc._id}/view`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('inline');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should allow document owner (Applicant 1) to download their document', async () => {
      const res = await request(app)
        .get(`/api/documents/${uploadedDoc._id}/download`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('should forbid Applicant 2 from viewing or downloading Applicant 1\'s document (403)', async () => {
      const resView = await request(app)
        .get(`/api/documents/${uploadedDoc._id}/view`)
        .set('Authorization', `Bearer ${token2}`);

      expect(resView.statusCode).toBe(403);
      expect(resView.body.success).toBe(false);
      expect(resView.body.message).toContain('Forbidden');

      const resDownload = await request(app)
        .get(`/api/documents/${uploadedDoc._id}/download`)
        .set('Authorization', `Bearer ${token2}`);

      expect(resDownload.statusCode).toBe(403);
    });

    it('should allow administrator to view and download any applicant\'s document', async () => {
      const resAdmin = await request(app)
        .get(`/api/documents/${uploadedDoc._id}/view`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAdmin.statusCode).toBe(200);
      expect(resAdmin.headers['content-type']).toBe('application/pdf');
    });

    it('should return 404 when document record does not exist in database', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/documents/${nonExistentId}/view`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 if file is deleted from filesystem storage', async () => {
      // Temporarily delete file from disk
      fs.unlinkSync(createdFilePath);

      const res = await request(app)
        .get(`/api/documents/${uploadedDoc._id}/view`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('could not be found on server storage');
    });

    it('should reject stored filenames that escape the upload directory (403)', async () => {
      const maliciousDoc = await UploadedDocument.create({
        application: app1._id,
        applicant: applicant1._id,
        documentType: 'Other',
        originalFileName: 'malicious.pdf',
        storedFileName: '../documents_evil.pdf',
        filePath: 'uploads/documents_evil.pdf',
        mimeType: 'application/pdf',
        fileSize: 100
      });

      const res = await request(app)
        .get(`/api/documents/${maliciousDoc._id}/view`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('path traversal');
    });
  });

  describe('GET /api/documents/application/:applicationId', () => {
    it('should list all uploaded documents for the authorized applicant', async () => {
      const pdfBuffer = createDummyPdfBuffer();
      const uploadRes = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${token1}`)
        .field('applicationId', app1._id.toString())
        .field('documentType', 'Class 10 Marksheet')
        .attach('document', pdfBuffer, 'doc10.pdf');

      const listRes = await request(app)
        .get(`/api/documents/application/${app1._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(listRes.statusCode).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].documentType).toBe('Class 10 Marksheet');

      const filePath = path.resolve(config.uploadDir, uploadRes.body.data.storedFileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    it('should forbid other applicants from listing documents of another application (403)', async () => {
      const res = await request(app)
        .get(`/api/documents/application/${app1._id}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
