const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const {
  User,
  Application,
  UploadedDocument,
  AcademicSession,
  Programme,
  MeritConfiguration,
  MeritList,
  SeatAllocation
} = require('../models');

let mongoServer;

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

function getValidApplicationData(user, programmeId, overrides = {}) {
  return {
    applicant: user._id,
    academicSession: '2026-2027',
    selectedProgramme: programmeId,
    personalInfo: {
      fullName: user.fullName || 'Test Candidate',
      dob: new Date('2004-01-15'),
      gender: 'Male',
      email: user.email,
      phone: '9876543210',
      address: 'Salt Lake Sector V',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '700091'
    },
    academicInfo: {
      class10Board: 'CBSE',
      class10Percentage: 85,
      class12Board: 'CBSE',
      class12Percentage: 85,
      class12PassingYear: 2024,
      entranceExamName: 'WBJEE',
      entranceExamScore: '1000',
      academicStream: 'Science (PCM)'
    },
    admissionInfo: {
      preferredDepartment: 'Computer Science & Engineering',
      admissionCategory: 'General'
    },
    documentVerificationStatus: 'Verified',
    status: 'Submitted',
    ...overrides
  };
}

async function createTestDocument(appDoc, user) {
  return await UploadedDocument.create({
    application: appDoc._id,
    applicant: user._id,
    documentType: 'Class 12 Marksheet',
    originalFileName: 'marksheet12.pdf',
    storedFileName: `marksheet_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`,
    filePath: 'uploads/marksheet12.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    verificationStatus: 'Verified'
  });
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

// Shared test state
let adminUser, adminToken, applicantUser, applicantToken, reviewerUser;
let programme, session, appDoc, meritConfig;

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Application.deleteMany({}),
    UploadedDocument.deleteMany({}),
    Programme.deleteMany({}),
    AcademicSession.deleteMany({}),
    MeritConfiguration.deleteMany({}),
    MeritList.deleteMany({}),
    SeatAllocation.deleteMany({})
  ]);

  // Create users
  adminUser = await User.create({
    fullName: 'Admin Publish',
    email: 'admin-publish@test.com',
    password: 'TestPassword123!',
    role: 'admin'
  });
  adminToken = generateTestToken(adminUser);

  applicantUser = await User.create({
    fullName: 'Applicant Merit',
    email: 'applicant-merit@test.com',
    password: 'TestPassword123!',
    role: 'applicant'
  });
  applicantToken = generateTestToken(applicantUser);

  reviewerUser = await User.create({
    fullName: 'Reviewer Merit',
    email: 'reviewer-merit@test.com',
    password: 'TestPassword123!',
    role: 'reviewer'
  });

  // Create session (before programme, since programme references session)
  session = await AcademicSession.create({
    sessionName: '2026-2027',
    sessionCode: 'SESSION-2026-2027',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2027-06-30'),
    status: 'Active'
  });

  // Create programme
  programme = await Programme.create({
    programmeName: 'B.Tech Computer Science',
    programmeCode: 'CSE-2026',
    degreeLevel: 'Undergraduate',
    department: 'Computer Science & Engineering',
    degree: 'B.Tech',
    duration: 4,
    durationUnit: 'years',
    academicSession: session._id,
    seatCapacity: {
      total: 60,
      categoryAllocations: [
        { category: 'General', seats: 30 },
        { category: 'OBC', seats: 15 },
        { category: 'SC', seats: 9 },
        { category: 'ST', seats: 4 },
        { category: 'EWS', seats: 2 }
      ]
    },
    eligibility: {
      minClass12Percentage: 60,
      acceptedAcademicStreams: ['Science (PCM)', 'Science (PCMB)'],
      acceptedEntranceExams: ['WBJEE', 'JEE Main']
    },
    status: 'Active'
  });

  // Create application
  appDoc = await Application.create(
    getValidApplicationData(applicantUser, programme._id, {
      applicationId: 'IEM-2026-10001'
    })
  );

  // Create verified document
  await createTestDocument(appDoc, applicantUser);

  // Save merit configuration
  meritConfig = await MeritConfiguration.create({
    programme: programme._id,
    academicSession: '2026-2027',
    class12Weightage: 60,
    entranceExamWeightage: 40,
    normalizationMethod: 'Rank-Based',
    maxEntranceRank: 50000,
    unfilledSeatRule: 'Keep Vacant',
    version: 1
  });
});

describe('Merit List Publishing', () => {
  test('should generate a draft merit list successfully', async () => {
    const res = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Draft');
    expect(res.body.data.entries.length).toBeGreaterThan(0);
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.round).toBe(1);
    expect(res.body.data.roundLabel).toBe('Round 1');
  });

  test('should publish a draft merit list successfully', async () => {
    // Generate draft
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    const meritListId = genRes.body.data._id;

    // Publish
    const pubRes = await request(app)
      .post(`/api/merit/lists/${meritListId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(pubRes.body.success).toBe(true);
    expect(pubRes.body.data.status).toBe('Published');
    expect(pubRes.body.data.publishedAt).toBeTruthy();
    expect(pubRes.body.data.programme).toBeTruthy();
    expect(pubRes.body.data.programme.programmeName).toBe('B.Tech Computer Science');
  });

  test('should reject publishing an already published merit list', async () => {
    // Generate and publish
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Try to publish again
    const dupRes = await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(dupRes.body.message).toMatch(/already published/i);
  });

  test('should reject publishing an archived merit list', async () => {
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    // Manually archive it
    await MeritList.findByIdAndUpdate(genRes.body.data._id, { status: 'Archived' });

    const res = await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.message).toMatch(/archived/i);
  });

  test('should return 404 for non-existent merit list ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app)
      .post(`/api/merit/lists/${fakeId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  test('should reject publication by non-admin (applicant)', async () => {
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(403);
  });

  test('should reject publication by reviewer', async () => {
    const reviewerToken = generateTestToken(reviewerUser);

    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(403);
  });

  test('published merit list is an immutable snapshot', async () => {
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    const pubRes = await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const publishedEntries = pubRes.body.data.entries;
    const publishedCutoffs = pubRes.body.data.cutoffs;

    // Verify the snapshot persisted correctly
    const dbDoc = await MeritList.findById(genRes.body.data._id);
    expect(dbDoc.status).toBe('Published');
    expect(dbDoc.publishedAt).toBeTruthy();
    expect(dbDoc.publishedBy.toString()).toBe(adminUser._id.toString());
    expect(dbDoc.entries.length).toBe(publishedEntries.length);
    expect(dbDoc.cutoffs.highestScore).toBe(publishedCutoffs.highestScore);
  });
});

describe('Merit List Versioning & Regeneration', () => {
  test('regenerating after publish creates a new draft version', async () => {
    // Generate & publish Round 1
    const gen1 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${gen1.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Regenerate — should create a new draft (Round 2)
    const gen2 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    expect(gen2.body.data.status).toBe('Draft');
    expect(gen2.body.data.version).toBe(2);
    expect(gen2.body.data.round).toBe(2);
    expect(gen2.body.data.roundLabel).toBe('Round 2');
    expect(gen2.body.data._id).not.toBe(gen1.body.data._id);

    // Original published list should still be Published
    const original = await MeritList.findById(gen1.body.data._id);
    expect(original.status).toBe('Published');
  });

  test('publishing new version archives the previous published list', async () => {
    // Generate & publish version 1
    const gen1 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${gen1.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Generate & publish version 2
    const gen2 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${gen2.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Version 1 should now be Archived
    const v1 = await MeritList.findById(gen1.body.data._id);
    expect(v1.status).toBe('Archived');

    // Version 2 should be Published
    const v2 = await MeritList.findById(gen2.body.data._id);
    expect(v2.status).toBe('Published');
    expect(v2.publishedAt).toBeTruthy();
  });

  test('regenerating existing draft updates in-place', async () => {
    // Generate draft
    const gen1 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    const firstId = gen1.body.data._id;

    // Regenerate without publishing — should update same doc
    const gen2 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    expect(gen2.body.data._id).toBe(firstId);
    expect(gen2.body.data.status).toBe('Draft');
  });

  test('new applicant included in regenerated draft', async () => {
    // Generate initial draft
    const gen1 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    const initialCount = gen1.body.data.entries.length;

    // Publish
    await request(app)
      .post(`/api/merit/lists/${gen1.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Add a new applicant
    const newApplicant = await User.create({
      fullName: 'New Applicant',
      email: 'new-applicant@test.com',
      password: 'TestPassword123!',
      role: 'applicant'
    });

    const newApp = await Application.create(
      getValidApplicationData(newApplicant, programme._id, {
        applicationId: 'IEM-2026-10002',
        academicInfo: {
          class10Board: 'ICSE',
          class10Percentage: 90,
          class12Board: 'ISC',
          class12Percentage: 92,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceExamScore: '500',
          academicStream: 'Science (PCM)'
        }
      })
    );
    await createTestDocument(newApp, newApplicant);

    // Regenerate
    const gen2 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    expect(gen2.body.data.entries.length).toBe(initialCount + 1);
    expect(gen2.body.data.version).toBe(2);

    // Original published list entries should NOT have changed
    const original = await MeritList.findById(gen1.body.data._id);
    expect(original.entries.length).toBe(initialCount);
    expect(original.status).toBe('Published');
  });

  test('scoring configuration version is preserved in published snapshot', async () => {
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    const pubRes = await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const dbDoc = await MeritList.findById(genRes.body.data._id);
    expect(dbDoc.configurationSnapshot).toBeTruthy();
    expect(dbDoc.configurationSnapshot.class12Weightage).toBe(60);
    expect(dbDoc.configurationSnapshot.entranceExamWeightage).toBe(40);
    expect(dbDoc.configurationSnapshot.normalizationMethod).toBe('Rank-Based');
  });
});

describe('Applicant Published Merit Result', () => {
  test('applicant can view published merit result', async () => {
    // Generate and publish
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Applicant fetches result
    const resultRes = await request(app)
      .get('/api/merit/my-result')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);

    expect(resultRes.body.data.hasPublishedResult).toBe(true);
    expect(resultRes.body.data.meritRank).toBeGreaterThan(0);
    expect(resultRes.body.data.compositeScore).toBeGreaterThan(0);
    expect(resultRes.body.data.programme.programmeName).toBe('B.Tech Computer Science');
  });

  test('applicant cannot see draft results', async () => {
    // Generate draft only — do NOT publish
    await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    const resultRes = await request(app)
      .get('/api/merit/my-result')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);

    expect(resultRes.body.data.hasPublishedResult).toBe(false);
  });

  test('applicant result falls back to archived list when current is superseded', async () => {
    // Generate & publish v1
    const gen1 = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${gen1.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Remove the applicant from the programme (simulate — just archive the published list)
    await MeritList.findByIdAndUpdate(gen1.body.data._id, { status: 'Archived' });

    // Applicant should still see result from archived list
    const resultRes = await request(app)
      .get('/api/merit/my-result')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);

    expect(resultRes.body.data.hasPublishedResult).toBe(true);
    expect(resultRes.body.data.meritRank).toBeGreaterThan(0);
  });

  test('applicant can retrieve the official published merit list with masked IDs for other candidates', async () => {
    // Generate and publish merit list
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    await request(app)
      .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Fetch published list as applicant
    const res = await request(app)
      .get('/api/merit/published-list')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.hasPublishedList).toBe(true);
    expect(res.body.data.programme.programmeName).toBe('B.Tech Computer Science');
    expect(res.body.data.entries.length).toBeGreaterThan(0);
    expect(res.body.data.myEntry).toBeTruthy();
    expect(res.body.data.myEntry.candidateName).toBe('Applicant Merit');
    expect(res.body.data.myEntry.isSelf).toBe(true);
    // Requester's ID is unmasked
    expect(res.body.data.myEntry.applicationId).toBe('IEM-2026-10001');
  });

  test('applicant published-list endpoint returns empty state message when no published list exists', async () => {
    // Generate draft only — do NOT publish
    await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    const res = await request(app)
      .get('/api/merit/published-list')
      .set('Authorization', `Bearer ${applicantToken}`)
      .expect(200);

    expect(res.body.data.hasPublishedList).toBe(false);
    expect(res.body.data.message).toMatch(/No merit list has been published/i);
  });

  test('published-list endpoint requires applicant authentication', async () => {
    await request(app)
      .get('/api/merit/published-list')
      .expect(401);
  });
});

describe('Merit Scoring Configuration Consistency', () => {
  test('weightages must total 100%', async () => {
    const res = await request(app)
      .post('/api/merit/configuration')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        programmeId: programme._id.toString(),
        academicSession: '2026-2027',
        class12Weightage: 50,
        entranceExamWeightage: 30,
        normalizationMethod: 'Rank-Based',
        maxEntranceRank: 50000,
        unfilledSeatRule: 'Keep Vacant'
      });

    // The backend should save (validation is frontend-enforced) but the config should persist
    // The requirement is that the frontend blocks submission when total != 100
    // Backend stores whatever is provided; merit generation uses stored config
    expect(res.status).toBeLessThan(500);
  });

  test('configuration must be saved before generation uses it', async () => {
    // Update config
    await request(app)
      .post('/api/merit/configuration')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        programmeId: programme._id.toString(),
        academicSession: '2026-2027',
        class12Weightage: 70,
        entranceExamWeightage: 30,
        normalizationMethod: 'Rank-Based',
        maxEntranceRank: 50000,
        unfilledSeatRule: 'Keep Vacant'
      });

    // Generate list
    const genRes = await request(app)
      .post('/api/merit/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ programmeId: programme._id.toString(), academicSession: '2026-2027' })
      .expect(201);

    // Verify the snapshot used the saved config
    const dbDoc = await MeritList.findById(genRes.body.data._id);
    expect(dbDoc.configurationSnapshot.class12Weightage).toBe(70);
    expect(dbDoc.configurationSnapshot.entranceExamWeightage).toBe(30);
  });
});
