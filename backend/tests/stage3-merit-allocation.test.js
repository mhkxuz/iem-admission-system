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
const meritService = require('../services/merit.service');

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
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await User.init();
  await Application.init();
  await UploadedDocument.init();
  await AcademicSession.init();
  await Programme.init();
  await MeritConfiguration.init();
  await MeritList.init();
  await SeatAllocation.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await SeatAllocation.deleteMany({});
  await MeritList.deleteMany({});
  await MeritConfiguration.deleteMany({});
  await UploadedDocument.deleteMany({});
  await Application.deleteMany({});
  await Programme.deleteMany({});
  await AcademicSession.deleteMany({});
  await User.deleteMany({});
});

describe('Stage 3 — Merit List Generation, Cutoff Engine and Category-Wise Seat Allocation', () => {
  let adminUser, adminToken;
  let reviewerUser, reviewerToken;
  let applicant1, applicant1Token;
  let applicant2, applicant2Token;
  let applicant3, applicant3Token;
  let testSession;
  let btechCSE;

  beforeEach(async () => {
    // 1. Create Users
    adminUser = await User.create({
      fullName: 'Admin Officer',
      email: 'admin@iem.edu',
      password: 'Password123!',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser);

    reviewerUser = await User.create({
      fullName: 'Faculty Reviewer',
      email: 'reviewer@iem.edu',
      password: 'Password123!',
      role: 'reviewer'
    });
    reviewerToken = generateTestToken(reviewerUser);

    applicant1 = await User.create({
      fullName: 'Rohan Sharma',
      email: 'rohan@example.com',
      password: 'Password123!',
      role: 'applicant'
    });
    applicant1Token = generateTestToken(applicant1);

    applicant2 = await User.create({
      fullName: 'Priya Verma',
      email: 'priya@example.com',
      password: 'Password123!',
      role: 'applicant'
    });
    applicant2Token = generateTestToken(applicant2);

    applicant3 = await User.create({
      fullName: 'Amit Kumar',
      email: 'amit@example.com',
      password: 'Password123!',
      role: 'applicant'
    });
    applicant3Token = generateTestToken(applicant3);

    // 2. Create Active Academic Session
    testSession = await AcademicSession.create({
      sessionName: '2026-2027',
      sessionCode: 'SESSION-2026-2027',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-06-30'),
      applicationStartDate: new Date('2026-01-01'),
      applicationEndDate: new Date('2026-12-31'),
      status: 'Active',
      isActive: true,
      isDefault: true,
      createdBy: adminUser._id
    });

    // 3. Create Programme with Seat Capacity & Quotas
    btechCSE = await Programme.create({
      programmeCode: 'BTECH-CSE',
      programmeName: 'B.Tech in Computer Science & Engineering',
      degreeLevel: 'Undergraduate',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years',
      academicSession: testSession._id,
      seatCapacity: {
        total: 3,
        categoryAllocations: [
          { category: 'General', seats: 1 },
          { category: 'OBC', seats: 1 },
          { category: 'SC', seats: 1 }
        ]
      },
      eligibility: {
        minClass12Percentage: 60,
        acceptedAcademicStreams: ['Science (PCM)', 'Science (PCMB)'],
        acceptedEntranceExams: ['WBJEE', 'JEE Main']
      },
      isActive: true,
      isApplicationOpen: true,
      createdBy: adminUser._id
    });
  });

  describe('1. Merit Configuration & Weightage Validation', () => {
    it('should reject configuration when weightages do not sum to 100', async () => {
      const res = await request(app)
        .post('/api/merit/configuration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027',
          class12Weightage: 60,
          entranceExamWeightage: 30 // Sum = 90
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/must (sum to|equal) exactly 100%/i);
    });

    it('should successfully save valid merit configuration and increment version upon update', async () => {
      const res1 = await request(app)
        .post('/api/merit/configuration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027',
          class12Weightage: 60,
          entranceExamWeightage: 40,
          normalizationMethod: 'Rank-Based',
          maxEntranceRank: 50000
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.version).toBe(1);
      expect(res1.body.data.class12Weightage).toBe(60);
      expect(res1.body.data.entranceExamWeightage).toBe(40);

      // Update configuration: Version should increment to 2
      const res2 = await request(app)
        .post('/api/merit/configuration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027',
          class12Weightage: 50,
          entranceExamWeightage: 50,
          normalizationMethod: 'Rank-Based',
          maxEntranceRank: 50000
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.version).toBe(2);
      expect(res2.body.data.class12Weightage).toBe(50);
      expect(res2.body.data.entranceExamWeightage).toBe(50);
    });

    it('should retrieve existing or default configuration', async () => {
      const res = await request(app)
        .get(`/api/merit/configuration?programmeId=${btechCSE._id}&academicSession=2026-2027`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.class12Weightage).toBe(60);
      expect(res.body.data.entranceExamWeightage).toBe(40);
    });
  });

  describe('2. Normalization & Tie-Breaking Unit Logic', () => {
    it('should normalize Rank-Based entrance ranks inverted properly', () => {
      // Rank 1 of 50000 -> 100
      const scoreRank1 = meritService.normalizeEntranceScore('1', 'Rank-Based', 100, 50000);
      expect(scoreRank1).toBe(100);

      // Rank 25000 of 50000 -> (1 - 24999/50000)*100 ≈ 50.002
      const scoreRankHalf = meritService.normalizeEntranceScore('25000', 'Rank-Based', 100, 50000);
      expect(scoreRankHalf).toBeCloseTo(50, 0);

      // Rank 50001 of 50000 -> 0
      const scoreRankOut = meritService.normalizeEntranceScore('55000', 'Rank-Based', 100, 50000);
      expect(scoreRankOut).toBe(0);
    });

    it('should break ties deterministically across all priority criteria', () => {
      const tieRules = [
        'higher_entrance_score',
        'higher_class12_percentage',
        'higher_class10_percentage',
        'older_candidate_age',
        'earlier_application_submission'
      ];

      // Two applicants with identical compositeScore, but diff entrance score
      const a1 = {
        compositeScore: 85,
        normalizedEntranceScore: 90,
        class12Percentage: 80,
        class10Percentage: 85,
        dob: new Date('2004-05-10'),
        submittedAt: new Date('2026-02-01')
      };
      const a2 = {
        compositeScore: 85,
        normalizedEntranceScore: 80,
        class12Percentage: 90,
        class10Percentage: 85,
        dob: new Date('2004-05-10'),
        submittedAt: new Date('2026-02-01')
      };

      // a1 has higher entrance score, so a1 comes before a2 (negative diff in sort)
      expect(meritService.compareApplicants(a1, a2, tieRules)).toBeLessThan(0);

      // Identical entrance & 12th, diff 10th
      const b1 = { ...a1, normalizedEntranceScore: 85, class12Percentage: 85, class10Percentage: 95 };
      const b2 = { ...a1, normalizedEntranceScore: 85, class12Percentage: 85, class10Percentage: 90 };
      expect(meritService.compareApplicants(b1, b2, tieRules)).toBeLessThan(0);

      // Identical scores, older age (earlier dob) wins
      const c1 = { ...b1, class10Percentage: 90, dob: new Date('2003-01-01') };
      const c2 = { ...b1, class10Percentage: 90, dob: new Date('2004-01-01') };
      expect(meritService.compareApplicants(c1, c2, tieRules)).toBeLessThan(0);
    });
  });

  describe('3. Merit List Generation & Cutoffs Computation', () => {
    beforeEach(async () => {
      // Create applications for 3 applicants:
      // Applicant 1: General, Class 12 = 90%, Entrance Rank = 500
      const app1 = await Application.create(
        getValidApplicationData(applicant1, btechCSE._id, {
          applicationId: 'IEM-2026-00001',
          academicInfo: {
            class10Board: 'CBSE',
            class10Percentage: 88,
            class12Board: 'CBSE',
            class12Percentage: 90,
            class12PassingYear: 2024,
            academicStream: 'Science (PCM)',
            entranceExamName: 'WBJEE',
            entranceExamScore: '500'
          },
          admissionInfo: {
            preferredDepartment: 'Computer Science & Engineering',
            admissionCategory: 'General'
          }
        })
      );

      // Mandatory doc verified
      await createTestDocument(app1, applicant1);

      // Applicant 2: OBC, Class 12 = 80%, Entrance Rank = 2000
      const app2 = await Application.create(
        getValidApplicationData(applicant2, btechCSE._id, {
          applicationId: 'IEM-2026-00002',
          academicInfo: {
            class10Board: 'CBSE',
            class10Percentage: 82,
            class12Board: 'CBSE',
            class12Percentage: 80,
            class12PassingYear: 2024,
            academicStream: 'Science (PCM)',
            entranceExamName: 'WBJEE',
            entranceExamScore: '2000'
          },
          admissionInfo: {
            preferredDepartment: 'Computer Science & Engineering',
            admissionCategory: 'OBC'
          }
        })
      );

      await createTestDocument(app2, applicant2);

      // Applicant 3: SC, Class 12 = 55% (< 60% minimum cutoff -> Ineligible)
      await Application.create(
        getValidApplicationData(applicant3, btechCSE._id, {
          applicationId: 'IEM-2026-00003',
          academicInfo: {
            class10Board: 'CBSE',
            class10Percentage: 70,
            class12Board: 'CBSE',
            class12Percentage: 55, // Ineligible (< 60)
            class12PassingYear: 2024,
            academicStream: 'Science (PCM)',
            entranceExamName: 'WBJEE',
            entranceExamScore: '5000'
          },
          admissionInfo: {
            preferredDepartment: 'Computer Science & Engineering',
            admissionCategory: 'SC'
          }
        })
      );
    });

    it('should generate draft merit list with cutoffs and identify ineligible candidates', async () => {
      const res = await request(app)
        .post('/api/merit/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const meritList = res.body.data;
      expect(meritList.status).toBe('Draft');
      expect(meritList.entries.length).toBe(3);

      // Check ranks of eligible candidates
      const rohan = meritList.entries.find((e) => e.candidateName.includes('Rohan'));
      const priya = meritList.entries.find((e) => e.candidateName.includes('Priya'));
      const amit = meritList.entries.find((e) => e.candidateName.includes('Amit'));

      expect(rohan.eligibilityStatus).toBe('Eligible');
      expect(rohan.meritRank).toBe(1);
      expect(rohan.categoryRank).toBe(1);

      expect(priya.eligibilityStatus).toBe('Eligible');
      expect(priya.meritRank).toBe(2);
      expect(priya.categoryRank).toBe(1); // Priya is 1st in OBC

      expect(amit.eligibilityStatus).toBe('Ineligible');
      expect(amit.meritRank).toBe(0); // Ineligible candidates have rank 0
      expect(amit.eligibilityRemarks).toMatch(/minimum.*cutoff|eligibility/i);

      // Check Cutoffs
      expect(meritList.cutoffs.highestScore).toBeGreaterThan(0);
      expect(meritList.cutoffs.totalEligible).toBe(2);
      expect(meritList.cutoffs.totalIneligible).toBe(1);
    });

    it('should publish merit list and archive previous published versions', async () => {
      // 1. Generate merit list
      const genRes = await request(app)
        .post('/api/merit/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027'
        });
      const listId1 = genRes.body.data._id;

      // 2. Publish it
      const pubRes = await request(app)
        .post(`/api/merit/lists/${listId1}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('Published');

      // 3. Generate a second merit list and publish it
      const genRes2 = await request(app)
        .post('/api/merit/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027'
        });
      const listId2 = genRes2.body.data._id;

      await request(app)
        .post(`/api/merit/lists/${listId2}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // List 1 should now be Archived, and List 2 Published
      const checkList1 = await MeritList.findById(listId1);
      const checkList2 = await MeritList.findById(listId2);
      expect(checkList1.status).toBe('Archived');
      expect(checkList2.status).toBe('Published');
    });
  });

  describe('4. Category-Wise Seat Allocation Engine', () => {
    let publishedMeritList;

    beforeEach(async () => {
      // Set up 2 applicants
      const app1 = await Application.create(
        getValidApplicationData(applicant1, btechCSE._id, {
          applicationId: 'IEM-2026-00001',
          academicInfo: {
            class10Board: 'CBSE',
            class10Percentage: 90,
            class12Board: 'CBSE',
            class12Percentage: 92,
            class12PassingYear: 2024,
            academicStream: 'Science (PCM)',
            entranceExamName: 'WBJEE',
            entranceExamScore: '200'
          },
          admissionInfo: {
            preferredDepartment: 'Computer Science & Engineering',
            admissionCategory: 'General'
          }
        })
      );
      await createTestDocument(app1, applicant1);

      const app2 = await Application.create(
        getValidApplicationData(applicant2, btechCSE._id, {
          applicationId: 'IEM-2026-00002',
          academicInfo: {
            class10Board: 'CBSE',
            class10Percentage: 85,
            class12Board: 'CBSE',
            class12Percentage: 88,
            class12PassingYear: 2024,
            academicStream: 'Science (PCM)',
            entranceExamName: 'WBJEE',
            entranceExamScore: '800'
          },
          admissionInfo: {
            preferredDepartment: 'Computer Science & Engineering',
            admissionCategory: 'OBC'
          }
        })
      );
      await createTestDocument(app2, applicant2);

      const genRes = await request(app)
        .post('/api/merit/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027'
        });

      const pubRes = await request(app)
        .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      publishedMeritList = pubRes.body.data;
    });

    it('should allocate Open/General merit seats first, then category quota seats', async () => {
      // btechCSE quotas: totalSeats: 3, general: 1, obc: 1, sc: 1
      const res = await request(app)
        .post('/api/merit/allocation/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027',
          meritListId: publishedMeritList._id.toString(),
          unfilledSeatRule: 'Keep Vacant'
        });

      expect(res.status).toBe(201);
      const allocation = res.body.data;
      expect(allocation.status).toBe('Draft');
      expect(allocation.allocatedSeats).toBe(2); // Rohan (Open) + Priya (OBC)
      expect(allocation.remainingSeats).toBe(1); // SC seat unfilled

      const rohanAlloc = allocation.allocations.find((a) => a.candidateName.includes('Rohan'));
      const priyaAlloc = allocation.allocations.find((a) => a.candidateName.includes('Priya'));

      expect(rohanAlloc.allocationStatus).toBe('Allocated');
      expect(rohanAlloc.allocatedCategory).toBe('General');
      expect(rohanAlloc.allocationReason).toMatch(/Open.*General.*Merit/i);

      expect(priyaAlloc.allocationStatus).toBe('Allocated');
      expect(priyaAlloc.allocatedCategory).toBe('OBC');
      expect(priyaAlloc.allocationReason).toMatch(/OBC Category Quota/i);
    });

    it('should complete approval and publishing lifecycle with audit trail', async () => {
      // 1. Generate draft allocation
      const genRes = await request(app)
        .post('/api/merit/allocation/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          programmeId: btechCSE._id.toString(),
          academicSession: '2026-2027',
          meritListId: publishedMeritList._id.toString()
        });
      const allocId = genRes.body.data._id;

      // 2. Approve draft allocation
      const appRes = await request(app)
        .post(`/api/merit/allocation/${allocId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ remarks: 'Verified category quotas against council guidelines.' });

      expect(appRes.status).toBe(200);
      expect(appRes.body.data.status).toBe('Approved');
      expect(appRes.body.data.history.length).toBe(2); // Generated + Approved

      // 3. Publish approved allocation
      const pubRes = await request(app)
        .post(`/api/merit/allocation/${allocId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ remarks: 'Published 1st round seat allocation.' });

      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('Published');
      expect(pubRes.body.data.history.length).toBe(3); // Generated + Approved + Published
    });
  });

  describe('5. Applicant Result View & RBAC Security', () => {
    it('should return 403 Forbidden when reviewer or applicant calls administrative endpoints', async () => {
      // Reviewer attempting admin merit generation
      const revRes = await request(app)
        .post('/api/merit/generate')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ programmeId: btechCSE._id.toString(), academicSession: '2026-2027' });
      expect(revRes.status).toBe(403);

      // Applicant attempting admin merit configuration
      const appRes = await request(app)
        .post('/api/merit/configuration')
        .set('Authorization', `Bearer ${applicant1Token}`)
        .send({ programmeId: btechCSE._id.toString(), academicSession: '2026-2027' });
      expect(appRes.status).toBe(403);
    });

    it('should hide results until published, then expose only caller result to applicant', async () => {
      // Create application
      const app1 = await Application.create(
        getValidApplicationData(applicant1, btechCSE._id, {
          applicationId: 'IEM-2026-00001',
          academicInfo: {
            class10Board: 'CBSE',
            class10Percentage: 90,
            class12Board: 'CBSE',
            class12Percentage: 92,
            class12PassingYear: 2024,
            academicStream: 'Science (PCM)',
            entranceExamName: 'WBJEE',
            entranceExamScore: '200'
          },
          admissionInfo: {
            preferredDepartment: 'Computer Science & Engineering',
            admissionCategory: 'General'
          }
        })
      );
      await createTestDocument(app1, applicant1);

      // Before merit list is published: hasPublishedResult should be false
      const preRes = await request(app)
        .get('/api/merit/my-result')
        .set('Authorization', `Bearer ${applicant1Token}`);

      expect(preRes.status).toBe(200);
      expect(preRes.body.data.hasPublishedResult).toBe(false);

      // Admin generates & publishes merit list
      const genRes = await request(app)
        .post('/api/merit/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ programmeId: btechCSE._id.toString(), academicSession: '2026-2027' });

      await request(app)
        .post(`/api/merit/lists/${genRes.body.data._id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Now applicant queries result: hasPublishedResult is true
      const postRes = await request(app)
        .get('/api/merit/my-result')
        .set('Authorization', `Bearer ${applicant1Token}`);

      expect(postRes.status).toBe(200);
      expect(postRes.body.data.hasPublishedResult).toBe(true);
      expect(postRes.body.data.candidateName).toMatch(/Rohan Sharma/i);
      expect(postRes.body.data.meritRank).toBe(1);
      expect(postRes.body.data.cutoffs).toBeDefined();
      expect(postRes.body.data.cutoffs.highestScore).toBeGreaterThan(0);
      // Ensure other applicants data is NOT included
      expect(postRes.body.data.entries).toBeUndefined();
      expect(postRes.body.data.allocations).toBeUndefined();
    });
  });
});
