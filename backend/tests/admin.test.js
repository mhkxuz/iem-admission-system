const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const { User, Application, UploadedDocument, ApplicationStatusHistory } = require('../models');

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
  await ApplicationStatusHistory.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await UploadedDocument.deleteMany({});
  await ApplicationStatusHistory.deleteMany({});
  await Application.deleteMany({});
  await User.deleteMany({});
});

describe('Stage 5: Admin Dashboard and Application Management API', () => {
  let adminUser, adminToken;
  let applicantUser, applicantToken;
  let sampleApps = [];

  beforeEach(async () => {
    adminUser = await User.create({
      fullName: 'Dean of Admissions',
      email: 'dean@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser);

    applicantUser = await User.create({
      fullName: 'General Applicant',
      email: 'applicant@iem.edu',
      password: 'Password@123',
      role: 'applicant'
    });
    applicantToken = generateTestToken(applicantUser);

    // Create 4 diverse test applicants and applications
    const candidates = [
      {
        fullName: 'Aarav Sharma',
        email: 'aarav@example.com',
        appId: 'IEM-2026-10001',
        dept: 'Computer Science & Engineering',
        cat: 'General',
        status: 'Submitted',
        c12Pct: 95.5,
        submittedAt: new Date('2026-03-01T10:00:00Z')
      },
      {
        fullName: 'Bhavna Sen',
        email: 'bhavna@example.com',
        appId: 'IEM-2026-10002',
        dept: 'Information Technology',
        cat: 'OBC',
        status: 'Under Review',
        c12Pct: 92.0,
        submittedAt: new Date('2026-03-02T11:00:00Z')
      },
      {
        fullName: 'Chirag Das',
        email: 'chirag@example.com',
        appId: 'IEM-2026-10003',
        dept: 'Electronics & Communication Engineering',
        cat: 'SC',
        status: 'Selected',
        c12Pct: 89.0,
        submittedAt: new Date('2026-03-03T12:00:00Z')
      },
      {
        fullName: 'Deepika Roy',
        email: 'deepika@example.com',
        appId: 'IEM-2026-10004',
        dept: 'Computer Science & Engineering',
        cat: 'General',
        status: 'Rejected',
        c12Pct: 80.0,
        submittedAt: new Date('2026-03-04T14:00:00Z')
      }
    ];

    sampleApps = [];
    for (const c of candidates) {
      const u = await User.create({
        fullName: c.fullName,
        email: c.email,
        password: 'Password@123',
        role: 'applicant'
      });

      const a = await Application.create({
        applicationId: c.appId,
        applicant: u._id,
        academicSession: '2026-2027',
        personalInfo: {
          fullName: c.fullName,
          dob: new Date('2005-01-01'),
          gender: 'Male',
          email: c.email,
          phone: '9830000001',
          address: 'Kolkata Sector V',
          state: 'West Bengal',
          city: 'Kolkata',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'CBSE',
          class10Percentage: 90,
          class12Board: 'CBSE',
          class12Percentage: c.c12Pct,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceExamScore: 'Rank 1500'
        },
        admissionInfo: {
          preferredDepartment: c.dept,
          admissionCategory: c.cat
        },
        status: c.status,
        submittedAt: c.submittedAt
      });

      sampleApps.push(a);
    }
  });

  describe('Authorization & Security Guards', () => {
    it('should reject unauthenticated request to /api/admin/dashboard (401)', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should forbid applicant user from accessing /api/admin/dashboard (403)', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should forbid applicant user from accessing /api/admin/applications (403)', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/dashboard', () => {
    it('should return accurate dashboard metrics based on actual MongoDB records', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.metrics.totalApplications).toBe(4);
      expect(res.body.data.metrics.submitted).toBe(1);
      expect(res.body.data.metrics.underReview).toBe(1);
      expect(res.body.data.metrics.selected).toBe(1);
      expect(res.body.data.metrics.rejected).toBe(1);
      expect(Array.isArray(res.body.data.recentApplications)).toBe(true);
    });

    it('should return zero metrics when database is empty', async () => {
      await Application.deleteMany({});

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.metrics.totalApplications).toBe(0);
      expect(res.body.data.metrics.submitted).toBe(0);
      expect(res.body.data.metrics.underReview).toBe(0);
      expect(res.body.data.recentApplications.length).toBe(0);
    });
  });

  describe('GET /api/admin/applications (Search, Filter, Sort & Pagination)', () => {
    it('should list all applications with default pagination and sorting', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
      expect(res.body.meta.totalRecords).toBe(4);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
      // Default sorted by submittedAt descending (Deepika submitted latest)
      expect(res.body.data[0].personalInfo.fullName).toBe('Deepika Roy');
    });

    it('should search applications by applicant name', async () => {
      const res = await request(app)
        .get('/api/admin/applications?search=Aarav')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].personalInfo.fullName).toBe('Aarav Sharma');
    });

    it('should search applications by Application ID', async () => {
      const res = await request(app)
        .get('/api/admin/applications?search=IEM-2026-10003')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].applicationId).toBe('IEM-2026-10003');
    });

    it('should filter applications by department', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .query({ department: 'Computer Science & Engineering' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.every(a => a.admissionInfo.preferredDepartment === 'Computer Science & Engineering')).toBe(true);
    });

    it('should filter applications by admission category', async () => {
      const res = await request(app)
        .get('/api/admin/applications?category=OBC')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].personalInfo.fullName).toBe('Bhavna Sen');
    });

    it('should filter applications by application status', async () => {
      const res = await request(app)
        .get('/api/admin/applications?status=Selected')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('Selected');
    });

    it('should sort applications ascending by submission date', async () => {
      const res = await request(app)
        .get('/api/admin/applications?sortBy=submittedAt&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      // Aarav submitted earliest (March 1)
      expect(res.body.data[0].personalInfo.fullName).toBe('Aarav Sharma');
      expect(res.body.data[3].personalInfo.fullName).toBe('Deepika Roy');
    });

    it('should paginate results correctly with custom page and limit', async () => {
      const resPage1 = await request(app)
        .get('/api/admin/applications?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resPage1.statusCode).toBe(200);
      expect(resPage1.body.data.length).toBe(2);
      expect(resPage1.body.meta.page).toBe(1);
      expect(resPage1.body.meta.limit).toBe(2);
      expect(resPage1.body.meta.totalPages).toBe(2);
      expect(resPage1.body.meta.hasNextPage).toBe(true);
      expect(resPage1.body.meta.hasPrevPage).toBe(false);

      const resPage2 = await request(app)
        .get('/api/admin/applications?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resPage2.statusCode).toBe(200);
      expect(resPage2.body.data.length).toBe(2);
      expect(resPage2.body.meta.page).toBe(2);
      expect(resPage2.body.meta.hasNextPage).toBe(false);
      expect(resPage2.body.meta.hasPrevPage).toBe(true);
    });

    it('should handle combined multi-criteria filters', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .query({
          department: 'Computer Science & Engineering',
          status: 'Submitted'
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].personalInfo.fullName).toBe('Aarav Sharma');
    });

    it('should safely normalize invalid page and limit parameters', async () => {
      const res = await request(app)
        .get('/api/admin/applications?page=-5&limit=1000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(100); // Capped at 100
    });
  });

  describe('GET /api/admin/applications/:id (Inspection)', () => {
    let testDoc;

    beforeEach(async () => {
      // Attach a document to Aarav's application
      const pdfBuffer = createDummyPdfBuffer();
      const uploadRes = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${generateTestToken(sampleApps[0].applicant)}`)
        .field('applicationId', sampleApps[0]._id.toString())
        .field('documentType', 'Class 12 Marksheet')
        .attach('document', pdfBuffer, 'aarav_marksheet.pdf');

      testDoc = uploadRes.body.data;
    });

    afterEach(() => {
      if (testDoc && testDoc.storedFileName) {
        const filePath = path.resolve(config.uploadDir, testDoc.storedFileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    it('should retrieve complete application details including attached documents', async () => {
      const res = await request(app)
        .get(`/api/admin/applications/${sampleApps[0]._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applicationId).toBe('IEM-2026-10001');
      expect(res.body.data.personalInfo.fullName).toBe('Aarav Sharma');
      expect(Array.isArray(res.body.data.documents)).toBe(true);
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.documents[0].documentType).toBe('Class 12 Marksheet');
    });

    it('should allow admin to retrieve document of any application via documents API', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDoc._id}/view`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });

    it('should return 404 for non-existent application ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/admin/applications/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
