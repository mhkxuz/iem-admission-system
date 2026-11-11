const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const { User, Application, ApplicationStatusHistory, AcademicSession, Programme } = require('../models');

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
      fullName: 'Suman Roy',
      dob: '2005-06-15',
      gender: 'Male',
      email: 'suman.roy@example.com',
      phone: '9830555123',
      address: 'EM Bypass',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '700098'
    },
    academicInfo: {
      class10Board: 'CBSE',
      class10Percentage: 90,
      class12Board: 'CBSE',
      class12Percentage: 85,
      class12PassingYear: 2024,
      entranceExamName: 'WBJEE',
      entranceExamScore: 'Rank 1200',
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
});

describe('Stage 1.4: Dynamic Application Form & Programme Integration API', () => {
  let applicant, applicantToken;
  let activeSession;
  let btechCseProgramme;

  beforeEach(async () => {
    applicant = await User.create({
      fullName: 'Suman Roy',
      email: 'suman@example.com',
      password: 'Password@123',
      role: 'applicant',
      phone: '9830555123'
    });
    applicantToken = generateTestToken(applicant);

    activeSession = await AcademicSession.create({
      sessionName: '2026-2027',
      sessionCode: 'SESS-2026-2027',
      isActive: true,
      status: 'Active',
      applicationStartDate: new Date(Date.now() - 86400000),
      applicationEndDate: new Date(Date.now() + 86400000 * 30),
      createdBy: applicant._id
    });

    btechCseProgramme = await Programme.create({
      programmeName: 'B.Tech in Computer Science & Engineering',
      programmeCode: 'BTECH-CSE',
      degreeLevel: 'Undergraduate',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years',
      academicSession: activeSession._id,
      eligibility: {
        minClass12Percentage: 60,
        acceptedAcademicStreams: ['Science (PCM)', 'Science (General)'],
        requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry'],
        acceptedEntranceExams: ['WBJEE', 'JEE Main']
      },
      seatCapacity: { total: 120 },
      isActive: true,
      isApplicationOpen: true
    });
  });

  it('should successfully submit an application linked to an academic programme', async () => {
    const payload = getValidApplicationPayload({
      selectedProgramme: btechCseProgramme._id.toString()
    });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.selectedProgramme).toBe(btechCseProgramme._id.toString());
    expect(res.body.data.admissionInfo.preferredDepartment).toBe('Computer Science & Engineering');
    expect(res.body.data.academicInfo.academicStream).toBe('Science (PCM)');
    expect(res.body.data.applicationId).toMatch(/^IEM-2026-\d{5}$/);
  });

  it('should populate selectedProgramme details when retrieving my-application', async () => {
    const payload = getValidApplicationPayload({
      selectedProgramme: btechCseProgramme._id.toString()
    });

    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send(payload);

    const getRes = await request(app)
      .get('/api/applications/my-application')
      .set('Authorization', `Bearer ${applicantToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data).toBeTruthy();
    expect(getRes.body.data.selectedProgramme).toBeTruthy();
    expect(getRes.body.data.selectedProgramme.programmeCode).toBe('BTECH-CSE');
    expect(getRes.body.data.selectedProgramme.department).toBe('Computer Science & Engineering');
  });

  it('should reject submission when Class 12 percentage is below programme minimum', async () => {
    const payload = getValidApplicationPayload({
      selectedProgramme: btechCseProgramme._id.toString(),
      academicInfo: {
        class10Board: 'CBSE',
        class10Percentage: 80,
        class12Board: 'CBSE',
        class12Percentage: 55, // Below 60% requirement
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: 'Rank 1200',
        academicStream: 'Science (PCM)'
      }
    });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Ineligible for B.Tech in Computer Science & Engineering');
    expect(res.body.message).toContain('Minimum Class 12 aggregate requirement is 60%');
  });

  it('should reject submission when academic stream is not accepted by programme', async () => {
    const payload = getValidApplicationPayload({
      selectedProgramme: btechCseProgramme._id.toString(),
      academicInfo: {
        class10Board: 'CBSE',
        class10Percentage: 85,
        class12Board: 'CBSE',
        class12Percentage: 88,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: 'Rank 1200',
        academicStream: 'Commerce' // Ineligible stream
      }
    });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Ineligible stream');
    expect(res.body.message).toContain('Commerce');
  });

  it('should reject submission if selected programme is not accepting applications', async () => {
    btechCseProgramme.isApplicationOpen = false;
    await btechCseProgramme.save();

    const payload = getValidApplicationPayload({
      selectedProgramme: btechCseProgramme._id.toString()
    });

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not currently accepting applications');
  });

  it('should maintain backward compatibility when no selectedProgramme is specified', async () => {
    const payload = getValidApplicationPayload(); // No selectedProgramme

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.selectedProgramme).toBeUndefined();
    expect(res.body.data.admissionInfo.preferredDepartment).toBe('Computer Science & Engineering');
  });
});
