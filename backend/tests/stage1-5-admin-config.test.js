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

function getValidApplicationPayload(overrides = {}) {
  return {
    academicSession: '2026-2027',
    personalInfo: {
      fullName: 'Aritra Sen',
      dob: '2005-04-12',
      gender: 'Male',
      email: 'aritra@example.com',
      phone: '9830111222',
      address: 'Salt Lake Sector V',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '700091'
    },
    academicInfo: {
      class10Board: 'ICSE',
      class10Percentage: 92,
      class12Board: 'ISC',
      class12Percentage: 91,
      class12PassingYear: 2024,
      entranceExamName: 'WBJEE',
      entranceExamScore: 'Rank 1100',
      academicStream: 'Science (PCM)'
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
  await Programme.init();
  await FeeStructure.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Application.deleteMany({});
  await ApplicationStatusHistory.deleteMany({});
  await User.deleteMany({});
  await AcademicSession.deleteMany({});
  await Programme.deleteMany({});
  await FeeStructure.deleteMany({});
});

describe('Stage 1.5: Administrative Programme & Session Configuration APIs', () => {
  let adminUser, adminToken;
  let applicantUser, applicantToken;
  let activeSession;
  let testProgramme;

  beforeEach(async () => {
    adminUser = await User.create({
      fullName: 'Chief Admissions Administrator',
      email: 'admin.iem@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser);

    applicantUser = await User.create({
      fullName: 'Aritra Sen',
      email: 'aritra@example.com',
      password: 'Password@123',
      role: 'applicant',
      phone: '9830111222'
    });
    applicantToken = generateTestToken(applicantUser);

    activeSession = await AcademicSession.create({
      sessionName: '2026-2027',
      sessionCode: 'AY2026-27',
      status: 'Active',
      isActive: true,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2027-06-30'),
      applicationStartDate: new Date('2026-01-01'),
      applicationEndDate: new Date('2026-12-31')
    });

    testProgramme = await Programme.create({
      programmeName: 'B.Tech in Computer Science & Engineering',
      programmeCode: 'BTECH-CSE',
      degreeLevel: 'Undergraduate',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years',
      academicSession: activeSession._id,
      seatCapacity: { total: 120 },
      isActive: true,
      isApplicationOpen: true
    });
  });

  // --- 1. RBAC & Authorization ---
  it('should reject unauthenticated access to admin endpoints', async () => {
    const res = await request(app).get('/api/admin/programmes');
    expect(res.status).toBe(401);
  });

  it('should reject applicant tokens from accessing admin endpoints', async () => {
    const res = await request(app)
      .get('/api/admin/programmes')
      .set('Authorization', `Bearer ${applicantToken}`);
    expect(res.status).toBe(403);
  });

  // --- 2. Dashboard Academic Overview ---
  it('should return real academic overview statistics in GET /api/admin/dashboard', async () => {
    // Create a fee structure so configuredFeeStructures = 1
    await FeeStructure.create({
      programme: testProgramme._id,
      academicSession: activeSession._id,
      applicationFee: 1000,
      admissionFee: 25000,
      semesterFees: [{ semesterNumber: 1, amount: 60000 }],
      totalProgrammeFee: 85000,
      isActive: true
    });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.academicOverview).toBeTruthy();
    expect(res.body.data.academicOverview.totalProgrammes).toBe(1);
    expect(res.body.data.academicOverview.activeProgrammes).toBe(1);
    expect(res.body.data.academicOverview.programmesAcceptingApplications).toBe(1);
    expect(res.body.data.academicOverview.activeSession).toBe('2026-2027');
    expect(res.body.data.academicOverview.configuredFeeStructures).toBe(1);
    expect(res.body.data.academicOverview.programmesMissingFee).toBe(0);
  });

  // --- 3. Programme Deletion Protection ---
  it('should prevent deleting a programme when existing applications reference it', async () => {
    // Create an application referencing testProgramme
    const appPayload = getValidApplicationPayload({
      selectedProgramme: testProgramme._id.toString()
    });

    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send(appPayload);

    // Attempt delete
    const deleteRes = await request(app)
      .delete(`/api/admin/programmes/${testProgramme._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.success).toBe(false);
    expect(deleteRes.body.message).toContain('application(s) reference this programme');

    // Verify programme is still intact
    const progCheck = await Programme.findById(testProgramme._id);
    expect(progCheck).toBeTruthy();
  });

  it('should allow deleting an unreferenced programme', async () => {
    const unreferencedProg = await Programme.create({
      programmeName: 'B.Tech in Mechanical Engineering',
      programmeCode: 'BTECH-ME',
      degreeLevel: 'Undergraduate',
      department: 'Mechanical Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years',
      seatCapacity: { total: 60 },
      isActive: true
    });

    const deleteRes = await request(app)
      .delete(`/api/admin/programmes/${unreferencedProg._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const check = await Programme.findById(unreferencedProg._id);
    expect(check).toBeNull();
  });

  // --- 4. Session Deletion Protection ---
  it('should prevent deleting a session when applications reference it', async () => {
    const appPayload = getValidApplicationPayload();

    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send(appPayload);

    const deleteRes = await request(app)
      .delete(`/api/admin/sessions/${activeSession._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.message).toContain('reference session');
  });

  // --- 5. Fee Structure Deletion ---
  it('should allow admin to delete a fee structure', async () => {
    const fee = await FeeStructure.create({
      programme: testProgramme._id,
      academicSession: activeSession._id,
      applicationFee: 1000,
      admissionFee: 25000,
      semesterFees: [{ semesterNumber: 1, amount: 60000 }],
      totalProgrammeFee: 85000,
      isActive: true
    });

    const res = await request(app)
      .delete(`/api/admin/fees/${fee._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const check = await FeeStructure.findById(fee._id);
    expect(check).toBeNull();
  });
});
