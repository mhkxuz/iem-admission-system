const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const {
  User,
  Application,
  ApplicationStatusHistory,
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

function getValidApplicationPayload(overrides = {}) {
  return {
    personalInfo: {
      fullName: 'Ananya Mukherjee',
      dob: '2005-08-20',
      gender: 'Female',
      email: 'ananya@example.com',
      phone: '9830998877',
      address: 'Salt Lake Sector II',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '700091'
    },
    academicInfo: {
      class10Board: 'CBSE',
      class10Percentage: 94.0,
      class12Board: 'CBSE',
      class12Percentage: 95.5,
      class12PassingYear: 2024,
      entranceExamName: 'WBJEE',
      entranceExamScore: 'Rank 850'
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
  await AcademicSession.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ApplicationStatusHistory.deleteMany({});
  await Application.deleteMany({});
  await AcademicSession.deleteMany({});
  await User.deleteMany({});
});

describe('Upgrade Stage 1.1: Academic Session Management & Application Integration', () => {
  let adminUser, adminToken;
  let applicantUser, applicantToken;

  beforeEach(async () => {
    adminUser = await User.create({
      fullName: 'Admissions Dean',
      email: 'dean@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser);

    applicantUser = await User.create({
      fullName: 'Ananya Mukherjee',
      email: 'ananya@example.com',
      password: 'ApplicantPassword@123',
      role: 'applicant'
    });
    applicantToken = generateTestToken(applicantUser);
  });

  describe('1. AcademicSession Model Validation', () => {
    it('should validate and create a valid draft session', async () => {
      const session = await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2027-06-30'),
        status: 'Draft',
        isActive: false
      });

      expect(session._id).toBeDefined();
      expect(session.sessionName).toBe('2026-2027');
      expect(session.sessionCode).toBe('2026-2027');
      expect(session.status).toBe('Draft');
      expect(session.isActive).toBe(false);
    });

    it('should fail validation when required fields are missing', async () => {
      await expect(AcademicSession.create({})).rejects.toThrow(
        /Session name is required/
      );
    });

    it('should reject invalid status enum value', async () => {
      await expect(
        AcademicSession.create({
          sessionName: '2026-2027',
          sessionCode: '2026-2027',
          status: 'Archived'
        })
      ).rejects.toThrow(/not a valid session status/);
    });

    it('should reject when startDate is later than endDate', async () => {
      await expect(
        AcademicSession.create({
          sessionName: '2026-2027',
          sessionCode: '2026-2027',
          startDate: new Date('2027-06-30'),
          endDate: new Date('2026-07-01')
        })
      ).rejects.toThrow(/Session start date cannot be later than end date/);
    });

    it('should reject when applicationStartDate is later than applicationEndDate', async () => {
      await expect(
        AcademicSession.create({
          sessionName: '2026-2027',
          sessionCode: '2026-2027',
          applicationStartDate: new Date('2026-12-31'),
          applicationEndDate: new Date('2026-01-01')
        })
      ).rejects.toThrow(/Application start date cannot be later than application end date/);
    });
  });

  describe('2. Admin Session Creation API (POST /api/admin/sessions)', () => {
    it('should allow an administrator to create a new session', async () => {
      const res = await request(app)
        .post('/api/admin/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sessionName: '2027-2028',
          sessionCode: 'IEM-2027-2028',
          startDate: '2027-07-01',
          endDate: '2028-06-30',
          applicationStartDate: '2027-01-01',
          applicationEndDate: '2027-06-15',
          description: 'Undergraduate Admission 2027-2028'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionName).toBe('2027-2028');
      expect(res.body.data.sessionCode).toBe('IEM-2027-2028');
      expect(res.body.data.status).toBe('Draft');
      expect(res.body.data.isActive).toBe(false);
    });

    it('should prevent duplicate sessionName (409 Conflict)', async () => {
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027'
      });

      const res = await request(app)
        .post('/api/admin/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sessionName: '2026-2027',
          sessionCode: 'DIFF-CODE'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should prevent duplicate sessionCode (409 Conflict)', async () => {
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: 'IEM-2627'
      });

      const res = await request(app)
        .post('/api/admin/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sessionName: '2026-2027-Alternate',
          sessionCode: 'IEM-2627'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject creation with missing required fields (400)', async () => {
      const res = await request(app)
        .post('/api/admin/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated and unauthorized requests', async () => {
      const resNoAuth = await request(app)
        .post('/api/admin/sessions')
        .send({ sessionName: '2028-2029', sessionCode: '2028-2029' });
      expect(resNoAuth.status).toBe(401);

      const resApplicant = await request(app)
        .post('/api/admin/sessions')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ sessionName: '2028-2029', sessionCode: '2028-2029' });
      expect(resApplicant.status).toBe(403);
    });
  });

  describe('3. Admin Session Listing & Retrieval (GET /api/admin/sessions)', () => {
    beforeEach(async () => {
      await AcademicSession.create([
        { sessionName: '2025-2026', sessionCode: '2025-2026', status: 'Closed', isActive: false },
        { sessionName: '2026-2027', sessionCode: '2026-2027', status: 'Active', isActive: true },
        { sessionName: '2027-2028', sessionCode: '2027-2028', status: 'Draft', isActive: false }
      ]);
    });

    it('should list all admission sessions for administrators', async () => {
      const res = await request(app)
        .get('/api/admin/sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
    });

    it('should filter sessions by status', async () => {
      const res = await request(app)
        .get('/api/admin/sessions?status=Closed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].sessionName).toBe('2025-2026');
    });

    it('should retrieve a specific session by ID', async () => {
      const session = await AcademicSession.findOne({ sessionName: '2026-2027' });

      const res = await request(app)
        .get(`/api/admin/sessions/${session._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.sessionName).toBe('2026-2027');
    });

    it('should return 404 for non-existent session ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/admin/sessions/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Session Modification & Activation Lifecycle', () => {
    let session1, session2;

    beforeEach(async () => {
      session1 = await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Active',
        isActive: true,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2027-06-30')
      });

      session2 = await AcademicSession.create({
        sessionName: '2027-2028',
        sessionCode: '2027-2028',
        status: 'Draft',
        isActive: false,
        startDate: new Date('2027-07-01'),
        endDate: new Date('2028-06-30')
      });
    });

    it('should update session metadata (PATCH /api/admin/sessions/:id)', async () => {
      const res = await request(app)
        .patch(`/api/admin/sessions/${session2._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated admission cycle description'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated admission cycle description');
    });

    it('should activate a new session and safely deactivate the previous active session', async () => {
      expect(session1.isActive).toBe(true);
      expect(session2.isActive).toBe(false);

      const res = await request(app)
        .patch(`/api/admin/sessions/${session2._id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.status).toBe('Active');

      // Verify previous session was deactivated
      const refreshedSession1 = await AcademicSession.findById(session1._id);
      expect(refreshedSession1.isActive).toBe(false);

      // Verify only ONE session is active
      const activeCount = await AcademicSession.countDocuments({ isActive: true });
      expect(activeCount).toBe(1);
    });

    it('should close an admission session (PATCH /api/admin/sessions/:id/close)', async () => {
      const res = await request(app)
        .patch(`/api/admin/sessions/${session1._id}/close`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('Closed');
      expect(res.body.data.isActive).toBe(false);

      const refreshed = await AcademicSession.findById(session1._id);
      expect(refreshed.status).toBe('Closed');
      expect(refreshed.isActive).toBe(false);
    });

    it('should reject activating a closed session', async () => {
      await AcademicSession.findByIdAndUpdate(session2._id, { status: 'Closed', isActive: false });

      const res = await request(app)
        .patch(`/api/admin/sessions/${session2._id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('closed');
    });
  });

  describe('5. Public Active Session Endpoint (GET /api/sessions/active)', () => {
    it('should return active session and application availability to public users', async () => {
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Active',
        isActive: true,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2027-06-30'),
        applicationStartDate: new Date('2026-01-01'),
        applicationEndDate: new Date('2026-12-31')
      });

      const res = await request(app).get('/api/sessions/active');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionName).toBe('2026-2027');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.isApplicationOpen).toBe(true);
    });

    it('should report isApplicationOpen as false if outside window', async () => {
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Active',
        isActive: true,
        applicationStartDate: new Date('2030-01-01'), // Future
        applicationEndDate: new Date('2030-12-31')
      });

      const res = await request(app).get('/api/sessions/active');

      expect(res.status).toBe(200);
      expect(res.body.data.isApplicationOpen).toBe(false);
    });

    it('should return null data when all sessions are inactive', async () => {
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Draft',
        isActive: false
      });

      const res = await request(app).get('/api/sessions/active');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  describe('6. Application Submission Integration & Backward Compatibility', () => {
    it('should successfully submit using the active admission session', async () => {
      await AcademicSession.create({
        sessionName: '2027-2028',
        sessionCode: '2027-2028',
        status: 'Active',
        isActive: true,
        applicationStartDate: new Date('2026-01-01'),
        applicationEndDate: new Date('2028-12-31')
      });

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(getValidApplicationPayload());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.academicSession).toBe('2027-2028');
      expect(res.body.data.applicationId).toMatch(/^IEM-2027-\d{5}$/);

      // Verify audit history was recorded
      const history = await ApplicationStatusHistory.find({
        application: res.body.data._id
      });
      expect(history.length).toBe(1);
      expect(history[0].newStatus).toBe('Submitted');
    });

    it('should reject application submission when no active session exists (400)', async () => {
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Closed',
        isActive: false
      });

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(getValidApplicationPayload());

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No active admission session');
    });

    it('should reject application submission when active session application deadline passed (400)', async () => {
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Active',
        isActive: true,
        applicationStartDate: new Date('2025-01-01'),
        applicationEndDate: new Date('2025-06-01') // Past date
      });

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(getValidApplicationPayload());

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('deadline');
    });

    it('should prevent duplicate applications for the same applicant in the same session (409)', async () => {
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Active',
        isActive: true
      });

      // First submission
      const res1 = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(getValidApplicationPayload());
      expect(res1.status).toBe(201);

      // Second submission in same session
      const res2 = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(getValidApplicationPayload());
      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('already submitted');
    });

    it('should allow an applicant to submit for a new session when activated', async () => {
      // 1. Session 2026-2027 submission
      const session26 = await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Active',
        isActive: true
      });

      const res1 = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(getValidApplicationPayload());
      expect(res1.status).toBe(201);
      expect(res1.body.data.academicSession).toBe('2026-2027');

      // 2. Activate Session 2027-2028
      const session27 = await AcademicSession.create({
        sessionName: '2027-2028',
        sessionCode: '2027-2028',
        status: 'Draft',
        isActive: false
      });

      await request(app)
        .patch(`/api/admin/sessions/${session27._id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      // 3. Second submission in the new session succeeds
      const res2 = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(getValidApplicationPayload());
      expect(res2.status).toBe(201);
      expect(res2.body.data.academicSession).toBe('2027-2028');

      // Both applications remain in database
      const userApps = await Application.find({ applicant: applicantUser._id });
      expect(userApps.length).toBe(2);
    });

    it('should preserve backward compatibility for existing applications', async () => {
      // Seed default session
      await AcademicSession.create({
        sessionName: '2026-2027',
        sessionCode: '2026-2027',
        status: 'Active',
        isActive: true
      });

      // Existing application record from Stage 3
      const legacyApp = await Application.create({
        applicationId: 'IEM-2026-12345',
        applicant: applicantUser._id,
        academicSession: '2026-2027',
        personalInfo: {
          fullName: 'Ananya Mukherjee',
          dob: new Date('2005-08-20'),
          gender: 'Female',
          email: 'ananya@example.com',
          phone: '9830998877',
          address: 'Salt Lake',
          state: 'West Bengal',
          city: 'Kolkata',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'CBSE',
          class10Percentage: 90,
          class12Board: 'CBSE',
          class12Percentage: 92,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceExamScore: 'Rank 500'
        },
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        },
        status: 'Submitted'
      });

      const res = await request(app)
        .get(`/api/applications/${legacyApp._id}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applicationId).toBe('IEM-2026-12345');
      expect(res.body.data.academicSession).toBe('2026-2027');
    });
  });
});
