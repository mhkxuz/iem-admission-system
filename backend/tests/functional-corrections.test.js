const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../app');
const {
  User,
  AcademicSession,
  Programme,
  FeeStructure,
  Application,
  Payment,
  Enrolment
} = require('../models');
const programmeService = require('../services/programme.service');
const meritService = require('../services/merit.service');
const paymentService = require('../services/payment.service');

let mongoServer;
let applicantToken;
let applicantUser;
let activeSession;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Initialize models
  await User.init();
  await AcademicSession.init();
  await Programme.init();
  await FeeStructure.init();
  await Application.init();
  await Payment.init();
  await Enrolment.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await AcademicSession.deleteMany({});
  await Programme.deleteMany({});
  await FeeStructure.deleteMany({});
  await Application.deleteMany({});
  await Payment.deleteMany({});
  await Enrolment.deleteMany({});

  // Create active session
  activeSession = await AcademicSession.create({
    sessionName: '2026-2027',
    sessionCode: '2026-2027',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2027-05-31'),
    applicationStartDate: new Date('2026-01-01'),
    applicationEndDate: new Date('2026-12-31'),
    status: 'Active',
    isActive: true
  });

  // Register applicant
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      fullName: 'Ananya Sen',
      email: 'ananya.sen@example.com',
      password: 'Password@123',
      phone: '9830111222'
    });

  applicantToken = regRes.body.data.token;
  applicantUser = regRes.body.data.user;
});

describe('Functional Corrections — Backend Validation & Business Logic', () => {
  describe('1. Default Programmes and Fee Structures Auto-Seeding', () => {
    it('should seed 6 default IEM programmes and active fee structures', async () => {
      expect(await Programme.countDocuments()).toBe(0);
      expect(await FeeStructure.countDocuments()).toBe(0);

      await programmeService.ensureDefaultProgrammesAndFees();

      const progCount = await Programme.countDocuments();
      const feeCount = await FeeStructure.countDocuments();

      expect(progCount).toBe(6);
      expect(feeCount).toBe(6);

      const btechCse = await Programme.findOne({ programmeCode: 'BTECH-CSE' });
      expect(btechCse).toBeTruthy();
      expect(btechCse.degree).toBe('B.Tech');
      expect(btechCse.department).toBe('Computer Science & Engineering');

      const bca = await Programme.findOne({ programmeCode: 'BCA' });
      expect(bca).toBeTruthy();
      expect(bca.degree).toBe('BCA');

      const bcaFee = await FeeStructure.findOne({ programme: bca._id, isActive: true });
      expect(bcaFee).toBeTruthy();
      expect(bcaFee.admissionFee).toBe(30000);
      expect(bcaFee.totalProgrammeFee).toBe(245000);

      // Verify idempotency
      await programmeService.ensureDefaultProgrammesAndFees();
      expect(await Programme.countDocuments()).toBe(6);
      expect(await FeeStructure.countDocuments()).toBe(6);
    });
  });

  describe('2. Board Selection & Custom Board Persistence', () => {
    it('should persist standard and custom board values correctly', async () => {
      await programmeService.ensureDefaultProgrammesAndFees();
      const btechProg = await Programme.findOne({ programmeCode: 'BTECH-CSE' });

      const payload = {
        academicSession: '2026-2027',
        selectedProgramme: btechProg._id.toString(),
        personalInfo: {
          fullName: 'Ananya Sen',
          dob: '2005-08-12',
          gender: 'Female',
          email: 'ananya.sen@example.com',
          phone: '9830111222',
          address: 'Salt Lake Sector V',
          city: 'Kolkata',
          state: 'West Bengal',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'CISCE / ICSE',
          class10Percentage: 92.5,
          class12Board: 'West Bengal State Board of Secondary Education', // Custom "Other" board
          class12Percentage: 88.0,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceResultType: 'Rank',
          entranceNumericScore: 2450,
          academicStream: 'Science (PCM)'
        },
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        }
      };

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.academicInfo.class10Board).toBe('CISCE / ICSE');
      expect(res.body.data.academicInfo.class12Board).toBe('West Bengal State Board of Secondary Education');
      expect(res.body.data.academicInfo.entranceResultType).toBe('Rank');
      expect(res.body.data.academicInfo.entranceNumericScore).toBe(2450);
      expect(res.body.data.academicInfo.entranceExamScore).toBe('Rank 2450');
    });
  });

  describe('3. Structured Entrance Result Type & Merit Normalization', () => {
    it('should normalize Rank, Percentile, and Score correctly without cross-type distortion', () => {
      // Rank normalization: Rank 1 -> 100%, Rank 50000 -> 0%
      const rank1 = meritService.normalizeEntranceScore('1', 'Rank-Based', 100, 50000, 'Rank', 1);
      const rank25000 = meritService.normalizeEntranceScore('25000', 'Rank-Based', 100, 50000, 'Rank', 25000);
      expect(rank1).toBe(100);
      expect(rank25000).toBeCloseTo(50.002, 1);

      // Percentile normalization: directly 0 - 100
      const pct98 = meritService.normalizeEntranceScore('98.5', 'Percentile', 100, 50000, 'Percentile', 98.5);
      expect(pct98).toBe(98.5);

      // Raw score normalization: (score / maxScore) * 100
      const score180 = meritService.normalizeEntranceScore('180', 'Score-Based', 200, 50000, 'Score', 180);
      expect(score180).toBe(90);
    });

    it('should reject invalid entrance rank values (e.g. rank 0 or negative)', async () => {
      await programmeService.ensureDefaultProgrammesAndFees();
      const btechProg = await Programme.findOne({ programmeCode: 'BTECH-CSE' });

      const invalidPayload = {
        academicSession: '2026-2027',
        selectedProgramme: btechProg._id.toString(),
        personalInfo: {
          fullName: 'Ananya Sen',
          dob: '2005-08-12',
          gender: 'Female',
          email: 'ananya.sen@example.com',
          phone: '9830111222',
          address: 'Salt Lake Sector V',
          city: 'Kolkata',
          state: 'West Bengal',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'CBSE',
          class10Percentage: 90,
          class12Board: 'CBSE',
          class12Percentage: 85,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceResultType: 'Rank',
          entranceNumericScore: 0, // Invalid: Rank must be >= 1
          academicStream: 'Science (PCM)'
        },
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        }
      };

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(invalidPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('positive integer greater than or equal to 1');
    });
  });

  describe('4. Non-Engineering Programme Submission (BCA / MCA / MBA)', () => {
    it('should allow BCA application submission without preferred engineering department', async () => {
      await programmeService.ensureDefaultProgrammesAndFees();
      const bcaProg = await Programme.findOne({ programmeCode: 'BCA' });

      const bcaPayload = {
        academicSession: '2026-2027',
        selectedProgramme: bcaProg._id.toString(),
        personalInfo: {
          fullName: 'Ananya Sen',
          dob: '2005-08-12',
          gender: 'Female',
          email: 'ananya.sen@example.com',
          phone: '9830111222',
          address: 'Salt Lake Sector V',
          city: 'Kolkata',
          state: 'West Bengal',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'WBCHSE',
          class10Percentage: 78.5,
          class12Board: 'WBCHSE',
          class12Percentage: 80.0,
          class12PassingYear: 2024,
          entranceExamName: '', // BCA does not require entrance exam
          entranceExamScore: '',
          academicStream: 'Science (PCM)'
        },
        admissionInfo: {
          preferredDepartment: null, // No engineering department required
          admissionCategory: 'General'
        }
      };

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(bcaPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.selectedProgramme.toString()).toBe(bcaProg._id.toString());
      expect(res.body.data.admissionInfo.preferredDepartment).toBeNull();
    });
  });

  describe('5. Fee Structure API Availability for Selected Programmes', () => {
    it('should return live fee structure for a seeded programme via public API', async () => {
      await programmeService.ensureDefaultProgrammesAndFees();
      const btechProg = await Programme.findOne({ programmeCode: 'BTECH-CSE' });

      const res = await request(app)
        .get(`/api/fees/programme/${btechProg._id}?session=2026-2027`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admissionFee).toBe(50000);
      expect(res.body.data.totalProgrammeFee).toBe(420000);
      expect(res.body.data.semesterFees.length).toBe(8);
    });
  });
});
