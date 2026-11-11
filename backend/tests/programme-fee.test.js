const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const {
  User,
  AcademicSession,
  Programme,
  FeeStructure
} = require('../models');

let mongoServer;

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

function getValidProgrammePayload(overrides = {}) {
  return {
    programmeName: 'B.Tech in Computer Science & Engineering',
    programmeCode: 'BTECH-CSE',
    degreeLevel: 'Undergraduate',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    description: 'Four-year undergraduate programme in Computer Science and Engineering.',
    duration: 4,
    durationUnit: 'years',
    eligibility: {
      minClass12Percentage: 60,
      requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry'],
      acceptedAcademicStreams: ['Science'],
      acceptedEntranceExams: ['WBJEE', 'JEE Main'],
      minEntranceScore: 'Rank under 15000',
      remarks: 'Candidate must have passed 10+2 with English as a compulsory subject.'
    },
    seatCapacity: {
      total: 120,
      categoryAllocations: [
        { category: 'General', seats: 60 },
        { category: 'OBC', seats: 30 },
        { category: 'SC', seats: 18 },
        { category: 'ST', seats: 6 },
        { category: 'EWS', seats: 6 }
      ]
    },
    requiredDocuments: [
      'Class 10 Marksheet',
      'Class 12 Marksheet',
      'Entrance Exam Rank Card',
      'Aadhaar Card'
    ],
    displayOrder: 1,
    ...overrides
  };
}

function getValidFeePayload(programmeId, sessionId, overrides = {}) {
  return {
    programme: programmeId,
    academicSession: sessionId,
    applicationFee: 1000,
    admissionFee: 25000,
    semesterFees: [
      { semesterNumber: 1, amount: 65000 },
      { semesterNumber: 2, amount: 65000 },
      { semesterNumber: 3, amount: 65000 },
      { semesterNumber: 4, amount: 65000 }
    ],
    additionalFees: [
      { feeName: 'Library & Lab Deposit', amount: 10000, description: 'Refundable security deposit' },
      { feeName: 'Student Activity Fee', amount: 5000, description: 'Annual extracurricular fee' }
    ],
    // Total = 25000 + (65000*4) + 10000 + 5000 = 300000
    totalProgrammeFee: 300000,
    currency: 'INR',
    paymentInstructions: 'Demand Draft in favour of Institute of Engineering & Management payable at Kolkata.',
    isActive: true,
    ...overrides
  };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await User.init();
  await AcademicSession.init();
  await Programme.init();
  await FeeStructure.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await FeeStructure.deleteMany({});
  await Programme.deleteMany({});
  await AcademicSession.deleteMany({});
  await User.deleteMany({});
});

describe('Upgrade Stage 1.2: Programme & Fee Management APIs', () => {
  let adminUser, adminToken;
  let applicantUser, applicantToken;
  let activeSession;

  beforeEach(async () => {
    adminUser = await User.create({
      fullName: 'Head of Admissions',
      email: 'admin.stage12@iem.edu',
      password: 'AdminPassword123!',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser);

    applicantUser = await User.create({
      fullName: 'Rahul Sen',
      email: 'rahul.stage12@example.com',
      password: 'ApplicantPass123!',
      role: 'applicant'
    });
    applicantToken = generateTestToken(applicantUser);

    activeSession = await AcademicSession.create({
      sessionName: '2026-2027',
      sessionCode: 'AY2026-27',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2027-06-30'),
      applicationStartDate: new Date('2026-01-01'),
      applicationEndDate: new Date('2026-12-31'),
      isActive: true,
      status: 'Active'
    });
  });

  // ==========================================
  // PROGRAMME MODEL & BUSINESS LOGIC TESTS
  // ==========================================
  describe('Programme Model Validation', () => {
    it('should fail validation if required fields are missing', async () => {
      const invalidProgramme = new Programme({});
      let err;
      try {
        await invalidProgramme.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors.programmeName).toBeDefined();
      expect(err.errors.programmeCode).toBeDefined();
      expect(err.errors.department).toBeDefined();
      expect(err.errors.degree).toBeDefined();
      expect(err.errors.duration).toBeDefined();
      expect(err.errors.seatCapacity).toBeDefined();
    });

    it('should fail validation if category allocations exceed total capacity', async () => {
      const payload = getValidProgrammePayload({
        seatCapacity: {
          total: 100,
          categoryAllocations: [
            { category: 'General', seats: 60 },
            { category: 'OBC', seats: 50 } // 60 + 50 = 110 > 100
          ]
        }
      });
      const programme = new Programme(payload);
      let err;
      try {
        await programme.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors['seatCapacity.categoryAllocations']).toBeDefined();
      expect(err.errors['seatCapacity.categoryAllocations'].message).toContain('cannot exceed total programme capacity');
    });

    it('should fail validation if minClass12Percentage is out of bounds', async () => {
      const programme = new Programme(
        getValidProgrammePayload({
          eligibility: { minClass12Percentage: 110 }
        })
      );
      let err;
      try {
        await programme.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors['eligibility.minClass12Percentage']).toBeDefined();
    });
  });

  // ==========================================
  // ADMINISTRATOR PROGRAMME API TESTS
  // ==========================================
  describe('Administrator Programme APIs', () => {
    it('should allow admin to create a new programme', async () => {
      const res = await request(app)
        .post('/api/admin/programmes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(getValidProgrammePayload({ academicSession: activeSession._id }));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.programmeCode).toBe('BTECH-CSE');
      expect(res.body.data.seatCapacity.total).toBe(120);
      expect(res.body.data.academicSession.sessionCode).toBe('AY2026-27');
      expect(res.body.data.offeredSessions).toHaveLength(1);
    });

    it('should prevent creating duplicate programme codes', async () => {
      await request(app)
        .post('/api/admin/programmes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(getValidProgrammePayload({ programmeCode: 'BTECH-IT' }));

      const res = await request(app)
        .post('/api/admin/programmes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(getValidProgrammePayload({ programmeCode: 'BTECH-IT', programmeName: 'Duplicate IT' }));

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should list programmes with search, filtering and pagination', async () => {
      // Seed 3 programmes
      await Programme.create(getValidProgrammePayload({ programmeCode: 'CSE-01', department: 'Computer Science & Engineering', degreeLevel: 'Undergraduate' }));
      await Programme.create(getValidProgrammePayload({ programmeCode: 'ECE-01', department: 'Electronics & Communication Engineering', degreeLevel: 'Undergraduate' }));
      await Programme.create(getValidProgrammePayload({ programmeCode: 'MCA-01', department: 'Computer Applications', degreeLevel: 'Postgraduate' }));

      // Search
      const searchRes = await request(app)
        .get('/api/admin/programmes?search=Electronics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.programmes).toHaveLength(1);
      expect(searchRes.body.data.programmes[0].programmeCode).toBe('ECE-01');

      // Filter by degreeLevel
      const levelRes = await request(app)
        .get('/api/admin/programmes?degreeLevel=Postgraduate')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(levelRes.status).toBe(200);
      expect(levelRes.body.data.programmes).toHaveLength(1);
      expect(levelRes.body.data.programmes[0].programmeCode).toBe('MCA-01');

      // Pagination
      const pageRes = await request(app)
        .get('/api/admin/programmes?limit=2&page=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pageRes.status).toBe(200);
      expect(pageRes.body.data.programmes).toHaveLength(2);
      expect(pageRes.body.data.total).toBe(3);
      expect(pageRes.body.data.totalPages).toBe(2);
    });

    it('should retrieve a programme by ID', async () => {
      const created = await Programme.create(getValidProgrammePayload());

      const res = await request(app)
        .get(`/api/admin/programmes/${created._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(created._id.toString());
      expect(res.body.data.programmeName).toBe(created.programmeName);
    });

    it('should update an existing programme', async () => {
      const created = await Programme.create(getValidProgrammePayload());

      const res = await request(app)
        .patch(`/api/admin/programmes/${created._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Updated comprehensive description.',
          seatCapacity: { total: 150, categoryAllocations: [{ category: 'General', seats: 80 }] }
        });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated comprehensive description.');
      expect(res.body.data.seatCapacity.total).toBe(150);
    });

    it('should activate and deactivate a programme', async () => {
      const created = await Programme.create(getValidProgrammePayload({ isActive: true }));

      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/admin/programmes/${created._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);

      // Reactivate
      const actRes = await request(app)
        .patch(`/api/admin/programmes/${created._id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(actRes.status).toBe(200);
      expect(actRes.body.data.isActive).toBe(true);
    });

    it('should reject non-admin access with 401 or 403', async () => {
      const unauthRes = await request(app).get('/api/admin/programmes');
      expect(unauthRes.status).toBe(401);

      const applicantRes = await request(app)
        .get('/api/admin/programmes')
        .set('Authorization', `Bearer ${applicantToken}`);
      expect(applicantRes.status).toBe(403);
    });
  });

  // ==========================================
  // PUBLIC PROGRAMME API TESTS
  // ==========================================
  describe('Public Programme APIs', () => {
    it('should list only active programmes publicly', async () => {
      await Programme.create(getValidProgrammePayload({ programmeCode: 'ACT-01', isActive: true }));
      await Programme.create(getValidProgrammePayload({ programmeCode: 'INACT-01', isActive: false }));

      const res = await request(app).get('/api/programmes');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].programmeCode).toBe('ACT-01');
    });

    it('should retrieve active programme by code and ID', async () => {
      const active = await Programme.create(getValidProgrammePayload({ programmeCode: 'PUB-CSE', isActive: true }));

      const codeRes = await request(app).get('/api/programmes/code/PUB-CSE');
      expect(codeRes.status).toBe(200);
      expect(codeRes.body.data.programmeName).toBe(active.programmeName);

      const idRes = await request(app).get(`/api/programmes/${active._id}`);
      expect(idRes.status).toBe(200);
      expect(idRes.body.data.programmeCode).toBe('PUB-CSE');
    });

    it('should return 404 for inactive programme in public endpoints', async () => {
      const inactive = await Programme.create(getValidProgrammePayload({ programmeCode: 'INACT-CODE', isActive: false }));

      const resCode = await request(app).get('/api/programmes/code/INACT-CODE');
      expect(resCode.status).toBe(404);

      const resId = await request(app).get(`/api/programmes/${inactive._id}`);
      expect(resId.status).toBe(404);
    });
  });

  // ==========================================
  // FEE STRUCTURE MODEL & BUSINESS LOGIC TESTS
  // ==========================================
  describe('Fee Structure Model Validation', () => {
    let testProg;

    beforeEach(async () => {
      testProg = await Programme.create(getValidProgrammePayload());
    });

    it('should fail validation if monetary amounts are negative', async () => {
      const invalidFee = new FeeStructure(
        getValidFeePayload(testProg._id, activeSession._id, {
          admissionFee: -500
        })
      );
      let err;
      try {
        await invalidFee.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors.admissionFee).toBeDefined();
    });

    it('should fail validation if semester numbers are duplicated', async () => {
      const invalidFee = new FeeStructure(
        getValidFeePayload(testProg._id, activeSession._id, {
          semesterFees: [
            { semesterNumber: 1, amount: 50000 },
            { semesterNumber: 1, amount: 50000 } // Duplicate
          ]
        })
      );
      let err;
      try {
        await invalidFee.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors.semesterFees).toBeDefined();
      expect(err.errors.semesterFees.message).toContain('Duplicate semester number');
    });

    it('should fail validation if totalProgrammeFee does not match component sum', async () => {
      const invalidFee = new FeeStructure(
        getValidFeePayload(testProg._id, activeSession._id, {
          admissionFee: 20000,
          semesterFees: [{ semesterNumber: 1, amount: 50000 }],
          additionalFees: [{ feeName: 'Lab', amount: 5000 }],
          // Expected sum = 20000 + 50000 + 5000 = 75000
          totalProgrammeFee: 999999 // Mismatched
        })
      );
      let err;
      try {
        await invalidFee.validate();
      } catch (error) {
        err = error;
      }
      expect(err).toBeDefined();
      expect(err.errors.totalProgrammeFee).toBeDefined();
      expect(err.errors.totalProgrammeFee.message).toContain('must be consistent with the sum');
    });

    it('should auto-compute totalProgrammeFee if omitted', async () => {
      const payload = getValidFeePayload(testProg._id, activeSession._id, {
        admissionFee: 20000,
        semesterFees: [
          { semesterNumber: 1, amount: 50000 },
          { semesterNumber: 2, amount: 50000 }
        ],
        additionalFees: [{ feeName: 'Exam', amount: 6000 }]
      });
      delete payload.totalProgrammeFee;

      const fee = new FeeStructure(payload);
      await fee.validate();
      expect(fee.totalProgrammeFee).toBe(126000); // 20000 + 100000 + 6000
    });
  });

  // ==========================================
  // ADMINISTRATOR FEE API TESTS
  // ==========================================
  describe('Administrator Fee APIs', () => {
    let testProg;

    beforeEach(async () => {
      testProg = await Programme.create(getValidProgrammePayload());
    });

    it('should create a fee structure linked to programme and session', async () => {
      const res = await request(app)
        .post('/api/admin/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(getValidFeePayload(testProg._id, activeSession._id));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProgrammeFee).toBe(300000);
      expect(res.body.data.programme.programmeCode).toBe('BTECH-CSE');
      expect(res.body.data.academicSession.sessionCode).toBe('AY2026-27');
    });

    it('should automatically deactivate previously active fee structure upon creating a new active one', async () => {
      // Create first active fee structure
      const firstRes = await request(app)
        .post('/api/admin/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(getValidFeePayload(testProg._id, activeSession._id, { totalProgrammeFee: 300000 }));
      expect(firstRes.status).toBe(201);
      const firstId = firstRes.body.data._id;

      // Create second active fee structure for same programme and session
      const secondRes = await request(app)
        .post('/api/admin/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          getValidFeePayload(testProg._id, activeSession._id, {
            admissionFee: 30000,
            semesterFees: [{ semesterNumber: 1, amount: 70000 }],
            additionalFees: [],
            totalProgrammeFee: 100000
          })
        );
      expect(secondRes.status).toBe(201);
      const secondId = secondRes.body.data._id;

      // Verify the first one is deactivated and preserved (not deleted)
      const firstCheck = await FeeStructure.findById(firstId);
      expect(firstCheck.isActive).toBe(false);

      const secondCheck = await FeeStructure.findById(secondId);
      expect(secondCheck.isActive).toBe(true);

      // Verify both exist in DB
      const count = await FeeStructure.countDocuments({ programme: testProg._id });
      expect(count).toBe(2);
    });

    it('should list fee structures with filtering and pagination', async () => {
      await request(app)
        .post('/api/admin/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(getValidFeePayload(testProg._id, activeSession._id));

      const res = await request(app)
        .get(`/api/admin/fees?programme=${testProg._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.feeStructures).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
    });

    it('should retrieve a fee structure by ID', async () => {
      const fee = await FeeStructure.create(getValidFeePayload(testProg._id, activeSession._id));

      const res = await request(app)
        .get(`/api/admin/fees/${fee._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(fee._id.toString());
    });

    it('should update and toggle active status of fee structure', async () => {
      const fee = await FeeStructure.create(getValidFeePayload(testProg._id, activeSession._id, { isActive: true }));

      // Deactivate
      const deact = await request(app)
        .patch(`/api/admin/fees/${fee._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deact.status).toBe(200);
      expect(deact.body.data.isActive).toBe(false);

      // Activate
      const act = await request(app)
        .patch(`/api/admin/fees/${fee._id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(act.status).toBe(200);
      expect(act.body.data.isActive).toBe(true);
    });

    it('should reject unauthorized access to admin fee routes with 401 or 403', async () => {
      const unauth = await request(app).get('/api/admin/fees');
      expect(unauth.status).toBe(401);

      const applicant = await request(app)
        .get('/api/admin/fees')
        .set('Authorization', `Bearer ${applicantToken}`);
      expect(applicant.status).toBe(403);
    });
  });

  // ==========================================
  // PUBLIC FEE API TESTS
  // ==========================================
  describe('Public Fee APIs', () => {
    let testProg;

    beforeEach(async () => {
      testProg = await Programme.create(getValidProgrammePayload({ academicSession: activeSession._id }));
    });

    it('should retrieve active fee structure by programme for the current active session', async () => {
      await FeeStructure.create(getValidFeePayload(testProg._id, activeSession._id));

      const res = await request(app).get(`/api/fees/programme/${testProg._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProgrammeFee).toBe(300000);
      expect(res.body.data.programme.programmeCode).toBe('BTECH-CSE');
      expect(res.body.data.academicSession.sessionCode).toBe('AY2026-27');
    });

    it('should retrieve active fee structure by programme code', async () => {
      await FeeStructure.create(getValidFeePayload(testProg._id, activeSession._id));

      const res = await request(app).get(`/api/fees/programme/${testProg.programmeCode}`);
      expect(res.status).toBe(200);
      expect(res.body.data.programme.programmeCode).toBe('BTECH-CSE');
    });

    it('should return 404 if no active fee structure exists for the programme', async () => {
      const res = await request(app).get(`/api/fees/programme/${testProg._id}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('No active fee structure found');
    });
  });
});
