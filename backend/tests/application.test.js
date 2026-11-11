const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const { User, Application, ApplicationStatusHistory } = require('../models');

let mongoServer;

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

function getValidApplicationPayload(overrides = {}) {
  return {
    academicSession: '2026-2027',
    personalInfo: {
      fullName: 'Rahul Sharma',
      dob: '2005-04-12',
      gender: 'Male',
      email: 'rahul.sharma@example.com',
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
      preferredDepartment: 'Computer Science & Engineering',
      admissionCategory: 'General'
    },
    ...overrides
  };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await User.init();
  await Application.init();
  await ApplicationStatusHistory.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Application.deleteMany({});
  await ApplicationStatusHistory.deleteMany({});
  await User.deleteMany({});
});

describe('Stage 3: Application Submission & Applicant Dashboard API', () => {
  let applicant1, token1;
  let applicant2, token2;
  let adminUser, adminToken;

  beforeEach(async () => {
    applicant1 = await User.create({
      fullName: 'Rahul Sharma',
      email: 'rahul@example.com',
      password: 'Password@123',
      role: 'applicant',
      phone: '9830123456'
    });
    token1 = generateTestToken(applicant1);

    applicant2 = await User.create({
      fullName: 'Priya Sen',
      email: 'priya@example.com',
      password: 'Password@123',
      role: 'applicant',
      phone: '9830987654'
    });
    token2 = generateTestToken(applicant2);

    adminUser = await User.create({
      fullName: 'Admin Official',
      email: 'admin@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser);
  });

  describe('POST /api/applications (Submission)', () => {
    it('should successfully submit an admission application and return 201', async () => {
      const payload = getValidApplicationPayload();

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applicationId).toBeDefined();
      expect(res.body.data.applicationId).toMatch(/^IEM-2026-\w{5}$/);
      expect(res.body.data.status).toBe('Submitted');
      expect(res.body.data.applicant).toBe(applicant1._id.toString());
      expect(res.body.data.admissionInfo.preferredDepartment).toBe('Computer Science & Engineering');

      // Verify audit history record was created
      const history = await ApplicationStatusHistory.findOne({
        application: res.body.data._id
      });
      expect(history).not.toBeNull();
      expect(history.newStatus).toBe('Submitted');
      expect(history.changedBy.toString()).toBe(applicant1._id.toString());
    });

    it('should ignore client-supplied applicant ID or status and enforce server values', async () => {
      const exploitPayload = getValidApplicationPayload({
        applicant: applicant2._id.toString(), // Attempted forgery
        status: 'Selected',                   // Attempted auto-approval
        applicationId: 'IEM-FAKE-99999'       // Attempted fake ID
      });

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(exploitPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.applicant).toBe(applicant1._id.toString());
      expect(res.body.data.status).toBe('Submitted');
      expect(res.body.data.applicationId).not.toBe('IEM-FAKE-99999');
    });

    it('should reject submission with missing required personal info fields', async () => {
      const invalidPayload = getValidApplicationPayload();
      delete invalidPayload.personalInfo.fullName;

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(invalidPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Full name is required');
    });

    it('should reject invalid percentages (<0 or >100)', async () => {
      const invalidPctPayload = getValidApplicationPayload();
      invalidPctPayload.academicInfo.class12Percentage = 105;

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(invalidPctPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Class 12 percentage');
    });

    it('should reject invalid PIN code format', async () => {
      const invalidPinPayload = getValidApplicationPayload();
      invalidPinPayload.personalInfo.pincode = '70009'; // 5 digits instead of 6

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(invalidPinPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('PIN code');
    });

    it('should reject invalid department choice', async () => {
      const invalidDeptPayload = getValidApplicationPayload();
      invalidDeptPayload.admissionInfo.preferredDepartment = 'Architecture';

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(invalidDeptPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Preferred department');
    });

    it('should reject future date of birth', async () => {
      const futureDobPayload = getValidApplicationPayload();
      futureDobPayload.personalInfo.dob = '2035-01-01';

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(futureDobPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('past');
    });

    it('should strictly prevent duplicate applications for same applicant and session', async () => {
      const payload = getValidApplicationPayload();

      // First submission
      const firstRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(payload);
      expect(firstRes.statusCode).toBe(201);

      // Second submission for same session
      const secondRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(payload);

      expect(secondRes.statusCode).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.message).toContain('already submitted');
    });

    it('should safely handle concurrent duplicate submissions', async () => {
      const payload = getValidApplicationPayload();

      // Fire 2 concurrent submission requests
      const [res1, res2] = await Promise.all([
        request(app).post('/api/applications').set('Authorization', `Bearer ${token1}`).send(payload),
        request(app).post('/api/applications').set('Authorization', `Bearer ${token1}`).send(payload)
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      expect(statusCodes).toEqual([201, 409]);

      // Exactly 1 application document should exist in the database
      const count = await Application.countDocuments({ applicant: applicant1._id });
      expect(count).toBe(1);
    });

    it('should reject submission from unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send(getValidApplicationPayload());

      expect(res.statusCode).toBe(401);
    });

    it('should forbid administrators from submitting applicant admission forms', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(getValidApplicationPayload());

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/applications/my-application (Dashboard Data)', () => {
    it('should return null when applicant has not yet submitted an application', async () => {
      const res = await request(app)
        .get('/api/applications/my-application')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('should return submitted application details when application exists', async () => {
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(getValidApplicationPayload());

      const res = await request(app)
        .get('/api/applications/my-application')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).not.toBeNull();
      expect(res.body.data.applicationId).toMatch(/^IEM-2026-\w{5}$/);
      expect(res.body.data.status).toBe('Submitted');
      expect(res.body.data.personalInfo.fullName).toBe('Rahul Sharma');
    });
  });

  describe('GET /api/applications/:id (Strict Isolation & Access Control)', () => {
    let app1Id;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(getValidApplicationPayload());
      app1Id = res.body.data._id;
    });

    it('should allow applicant to retrieve their own application by ID', async () => {
      const res = await request(app)
        .get(`/api/applications/${app1Id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data._id).toBe(app1Id);
    });

    it('should forbid Applicant B from accessing Applicant A\'s application (403)', async () => {
      const res = await request(app)
        .get(`/api/applications/${app1Id}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should allow administrator to inspect any application by ID', async () => {
      const res = await request(app)
        .get(`/api/applications/${app1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data._id).toBe(app1Id);
    });
  });

  describe('Application ID Uniqueness', () => {
    it('should generate distinct unique IDs for applications from different applicants', async () => {
      const res1 = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token1}`)
        .send(getValidApplicationPayload({
          personalInfo: {
            fullName: 'Applicant One',
            dob: '2005-01-01',
            gender: 'Male',
            email: 'app1@example.com',
            phone: '9830111111',
            address: 'Address 1',
            state: 'WB',
            city: 'Kolkata',
            pincode: '700001'
          }
        }));

      const res2 = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token2}`)
        .send(getValidApplicationPayload({
          personalInfo: {
            fullName: 'Applicant Two',
            dob: '2005-02-02',
            gender: 'Female',
            email: 'app2@example.com',
            phone: '9830222222',
            address: 'Address 2',
            state: 'WB',
            city: 'Kolkata',
            pincode: '700002'
          }
        }));

      expect(res1.statusCode).toBe(201);
      expect(res2.statusCode).toBe(201);
      expect(res1.body.data.applicationId).not.toBe(res2.body.data.applicationId);
    });
  });
});
