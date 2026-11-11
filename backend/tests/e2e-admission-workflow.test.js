/**
 * End-to-End Admission Workflow Integration Test
 *
 * Tests the complete lifecycle: application → document verification → merit generation →
 * seat allocation → payment → enrolment, verifying that the programme-linking
 * fix correctly maps legacy applications.
 */

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

const {
  User,
  Application,
  Programme,
  AcademicSession,
  UploadedDocument,
  MeritConfiguration,
  MeritList,
  SeatAllocation,
  Payment,
  Enrolment
} = require('../models');

const meritService = require('../services/merit.service');
const paymentService = require('../services/payment.service');
const legacyMigration = require('../services/legacy-migration.service');
const { ensureDefaultProgrammesAndFees } = require('../services/programme.service');

// Reusable test personal info (model field is `dob`, not `dateOfBirth`)
const testPersonal = {
  fullName: 'Samarpan Das',
  email: 'samarpan@example.com',
  phone: '9000000003',
  dob: new Date('2004-05-15'),
  gender: 'Male',
  address: '123 Test St',
  state: 'West Bengal',
  city: 'Kolkata',
  pincode: '700001'
};

const testAcademic = {
  class10Board: 'ICSE',
  class10Percentage: 90,
  class12Board: 'CBSE',
  class12Percentage: 85,
  class12PassingYear: 2024,
  entranceExamName: 'JEE Main',
  entranceExamScore: 'Rank 1450',
  academicStream: 'Science (PCM)'
};

describe('End-to-End Admission Workflow Integration', () => {
  let admin, reviewer, applicant;
  let session, programme;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('TestPass@123', salt);

    admin = await User.create({
      fullName: 'Admin User',
      email: 'admin@iem.edu',
      password: hashed,
      phone: '9000000001',
      role: 'admin'
    });

    reviewer = await User.create({
      fullName: 'Reviewer User',
      email: 'reviewer@iem.edu',
      password: hashed,
      phone: '9000000002',
      role: 'reviewer'
    });

    applicant = await User.create({
      fullName: 'Samarpan Das',
      email: 'samarpan@example.com',
      password: hashed,
      phone: '9000000003',
      role: 'applicant'
    });

    session = await AcademicSession.create({
      sessionName: '2026-2027',
      sessionCode: '2026-2027',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-06-30'),
      applicationStartDate: new Date('2026-01-01'),
      applicationEndDate: new Date('2027-06-30'),
      isActive: true,
      status: 'Active'
    });

    await ensureDefaultProgrammesAndFees();
    programme = await Programme.findOne({ programmeCode: 'BTECH-CSE' });
  });

  describe('1. Legacy application migration', () => {
    test('should map a legacy application (no selectedProgramme) to the correct programme', async () => {
      const legacyApp = await Application.create({
        applicationId: 'IEM-2026-99001',
        applicant: applicant._id,
        academicSession: '2026-2027',
        personalInfo: testPersonal,
        academicInfo: testAcademic,
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        },
        status: 'Selected',
        submittedAt: new Date()
      });

      // selectedProgramme is undefined/falsy before migration
      const before = await Application.findById(legacyApp._id);
      expect(before.selectedProgramme).toBeFalsy();

      const result = await legacyMigration.migrateLegacyApplications();
      expect(result.mapped).toBe(1);
      expect(result.skipped).toBe(0);

      const after = await Application.findById(legacyApp._id);
      expect(after.selectedProgramme.toString()).toBe(programme._id.toString());
    });

    test('should not overwrite an application that already has selectedProgramme', async () => {
      await Application.create({
        applicationId: 'IEM-2026-99002',
        applicant: applicant._id,
        academicSession: '2026-2027',
        selectedProgramme: programme._id,
        personalInfo: testPersonal,
        academicInfo: testAcademic,
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        },
        status: 'Selected',
        submittedAt: new Date()
      });

      const result = await legacyMigration.migrateLegacyApplications();
      expect(result.mapped).toBe(0);
    });
  });

  describe('2. Merit generation finds programme-linked applications', () => {
    test('should find applications by selectedProgramme and generate a merit list', async () => {
      const app = await Application.create({
        applicationId: 'IEM-2026-99010',
        applicant: applicant._id,
        academicSession: '2026-2027',
        selectedProgramme: programme._id,
        personalInfo: testPersonal,
        academicInfo: testAcademic,
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        },
        status: 'Selected',
        submittedAt: new Date()
      });

      await UploadedDocument.create({
        application: app._id,
        applicant: applicant._id,
        documentType: 'Class 12 Marksheet',
        originalFileName: 'marksheet.pdf',
        storedFileName: 'stored-marksheet.pdf',
        filePath: '/uploads/documents/stored-marksheet.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        verificationStatus: 'Verified',
        verifiedBy: reviewer._id,
        verificationRemarks: 'Authentic document'
      });

      const meritList = await meritService.generateMeritList({
        programmeId: programme._id.toString(),
        academicSession: '2026-2027',
        adminId: admin._id.toString()
      });

      expect(meritList).toBeDefined();
      expect(meritList.entries.length).toBe(1);
      // Entry field is `candidateName` (not `applicantName`)
      expect(meritList.entries[0].candidateName).toBe('Samarpan Das');
      expect(meritList.entries[0].compositeScore).toBeGreaterThan(0);
    });

    test('should find a migrated legacy application in merit generation', async () => {
      await Application.create({
        applicationId: 'IEM-2026-99020',
        applicant: applicant._id,
        academicSession: '2026-2027',
        personalInfo: testPersonal,
        academicInfo: { ...testAcademic, class12Percentage: 80 },
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        },
        status: 'Selected',
        submittedAt: new Date()
      });

      const migResult = await legacyMigration.migrateLegacyApplications();
      expect(migResult.mapped).toBe(1);

      const meritList = await meritService.generateMeritList({
        programmeId: programme._id.toString(),
        academicSession: '2026-2027',
        adminId: admin._id.toString()
      });

      expect(meritList.entries.length).toBe(1);
      expect(meritList.entries[0].candidateName).toBe('Samarpan Das');
    });
  });

  describe('3. Complete admission workflow: merit → allocation → payment → enrolment', () => {
    test('should complete the full admission lifecycle for one applicant', async () => {
      // 1. Create properly-linked application
      const app = await Application.create({
        applicationId: 'IEM-2026-99030',
        applicant: applicant._id,
        academicSession: '2026-2027',
        selectedProgramme: programme._id,
        personalInfo: testPersonal,
        academicInfo: testAcademic,
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        },
        status: 'Selected',
        submittedAt: new Date()
      });

      // 2. Upload and verify documents (both mandatory types)
      await UploadedDocument.create({
        application: app._id,
        applicant: applicant._id,
        documentType: 'Class 12 Marksheet',
        originalFileName: 'marksheet12.pdf',
        storedFileName: 'stored-marksheet12.pdf',
        filePath: '/uploads/documents/stored-marksheet12.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        verificationStatus: 'Verified',
        verifiedBy: reviewer._id,
        verificationRemarks: 'Verified by reviewer'
      });
      await UploadedDocument.create({
        application: app._id,
        applicant: applicant._id,
        documentType: 'Class 10 Marksheet',
        originalFileName: 'marksheet10.pdf',
        storedFileName: 'stored-marksheet10.pdf',
        filePath: '/uploads/documents/stored-marksheet10.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        verificationStatus: 'Verified',
        verifiedBy: reviewer._id,
        verificationRemarks: 'Verified by reviewer'
      });

      // 3. Generate merit list
      const meritList = await meritService.generateMeritList({
        programmeId: programme._id.toString(),
        academicSession: '2026-2027',
        adminId: admin._id.toString()
      });
      expect(meritList.entries.length).toBe(1);
      expect(meritList.entries[0].eligibilityStatus).toContain('Eligible');
      expect(meritList.entries[0].meritRank).toBe(1);

      // 4. Publish merit list (positional args: meritListId, adminId)
      const publishedMerit = await meritService.publishMeritList(
        meritList._id.toString(),
        admin._id.toString()
      );
      expect(publishedMerit.status).toBe('Published');

      // 5. Generate seat allocation
      const allocation = await meritService.generateSeatAllocation({
        programmeId: programme._id.toString(),
        academicSession: '2026-2027',
        adminId: admin._id.toString()
      });
      expect(allocation.allocations.length).toBeGreaterThan(0);

      const ourAlloc = allocation.allocations.find(
        (a) => a.applicant?.toString() === applicant._id.toString()
      );
      expect(ourAlloc).toBeDefined();
      expect(ourAlloc.allocationStatus).toBe('Allocated');

      // 6. Publish seat allocation (positional args: allocationId, adminId)
      const publishedAlloc = await meritService.publishSeatAllocation(
        allocation._id.toString(),
        admin._id.toString()
      );
      expect(publishedAlloc.status).toBe('Published');

      // 7. Create payment order (sandbox)
      const order = await paymentService.createPaymentOrder({
        applicantId: applicant._id.toString(),
        idempotencyKey: 'test-key-001'
      });
      expect(order).toBeDefined();

      // 8. Simulate successful payment
      const paymentResult = await paymentService.verifyPayment({
        orderId: order.orderId || order.orderNumber || order._id.toString(),
        paymentId: 'pay_sandbox_test_001',
        signature: 'sandbox_valid_sig',
        applicantId: applicant._id.toString()
      });
      expect(paymentResult).toBeDefined();

      // 9. Verify enrolment was generated
      const enrolment = await Enrolment.findOne({ applicant: applicant._id });
      expect(enrolment).toBeDefined();
      expect(enrolment.enrolmentNumber).toMatch(/^ENR-/);

      // 10. Verify exactly one enrolment exists
      const enrolmentCount = await Enrolment.countDocuments({ applicant: applicant._id });
      expect(enrolmentCount).toBe(1);
    });
  });

  describe('4. Admin manual programme assignment', () => {
    test('should allow admin to manually assign programme to an unmapped application', async () => {
      const app = await Application.create({
        applicationId: 'IEM-2026-99040',
        applicant: applicant._id,
        academicSession: '2026-2027',
        personalInfo: testPersonal,
        academicInfo: testAcademic,
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        },
        status: 'Selected',
        submittedAt: new Date()
      });

      const unmapped = await legacyMigration.getUnmappedApplications();
      expect(unmapped.length).toBe(1);
      expect(unmapped[0].applicationId).toBe('IEM-2026-99040');

      const result = await legacyMigration.adminAssignProgramme(
        app._id.toString(),
        programme._id.toString(),
        admin._id.toString()
      );
      expect(result.application.assignedProgramme).toBe('B.Tech in Computer Science & Engineering');

      const afterUnmapped = await legacyMigration.getUnmappedApplications();
      expect(afterUnmapped.length).toBe(0);

      const meritList = await meritService.generateMeritList({
        programmeId: programme._id.toString(),
        academicSession: '2026-2027',
        adminId: admin._id.toString()
      });
      expect(meritList.entries.length).toBe(1);
    });
  });
});
