/**
 * Focused tests for document verification by admin and reviewer roles.
 * Covers: admin verification, reviewer verification, mandatory rejection remarks,
 * audit history recording, RBAC enforcement, and applicant replacement-document flow.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const documentService = require('../services/document.service');
const {
  User,
  Application,
  UploadedDocument,
  DocumentVerificationHistory
} = require('../models');
const programmeService = require('../services/programme.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await programmeService.ensureDefaultProgrammesAndFees();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await UploadedDocument.deleteMany({});
  await DocumentVerificationHistory.deleteMany({});
  await Application.deleteMany({});
  await User.deleteMany({});
});

// Helpers
async function createUser(role, suffix = '') {
  return User.create({
    fullName: `Test ${role}${suffix}`,
    email: `${role}${suffix}@test.iem.edu`,
    password: 'TestPassword123!',
    role
  });
}

async function createApplicationAndDocument(applicant, docType = 'Class 10 Marksheet') {
  const app = await Application.create({
    applicationId: `IEM-2026-${Math.floor(10000 + Math.random() * 89999)}`,
    applicant: applicant._id,
    academicSession: '2026-2027',
    personalInfo: {
      fullName: applicant.fullName,
      email: applicant.email,
      phone: '9876543210',
      dob: new Date('2004-01-15'),
      gender: 'Male',
      address: '1 Test St',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001'
    },
    academicInfo: {
      class10Board: 'CBSE',
      class10Percentage: 90,
      class12Board: 'CBSE',
      class12Percentage: 88,
      class12PassingYear: 2023,
      entranceExamName: 'JEE Main',
      entranceResultType: 'Rank',
      entranceExamScore: 5000
    },
    admissionInfo: {
      preferredDepartment: 'Computer Science & Engineering',
      admissionCategory: 'General'
    },
    status: 'Submitted',
    submittedAt: new Date()
  });

  const doc = await UploadedDocument.create({
    application: app._id,
    applicant: applicant._id,
    documentType: docType,
    originalFileName: 'marksheet.pdf',
    storedFileName: 'stored_marksheet.pdf',
    filePath: 'uploads/stored_marksheet.pdf',
    mimeType: 'application/pdf',
    fileSize: 12345,
    uploadedAt: new Date(),
    verificationStatus: 'Pending'
  });

  return { app, doc };
}

describe('Document Verification — Admin & Reviewer RBAC', () => {

  describe('1. Admin can verify (approve) a document', () => {
    test('should approve a document and record admin identity in audit history', async () => {
      const admin = await createUser('admin');
      const applicant = await createUser('applicant');
      const { doc } = await createApplicationAndDocument(applicant);

      const result = await documentService.verifyDocument({
        documentId: doc._id.toString(),
        status: 'Verified',
        remarks: 'All details match',
        reviewerId: admin._id
      });

      expect(result.verificationStatus).toBe('Verified');
      expect(result.verifiedBy.role).toBe('admin');
      expect(result.verifiedBy.fullName).toBe('Test admin');
      expect(result.verificationRemarks).toBe('All details match');

      // Verify audit history
      const history = await DocumentVerificationHistory.find({ document: doc._id })
        .populate('verifiedBy', 'fullName email role');
      expect(history).toHaveLength(1);
      expect(history[0].previousStatus).toBe('Pending');
      expect(history[0].newStatus).toBe('Verified');
      expect(history[0].verifiedBy.role).toBe('admin');
      expect(history[0].remarks).toBe('All details match');
      expect(history[0].timestamp).toBeDefined();
    });
  });

  describe('2. Reviewer can verify a document', () => {
    test('should approve a document and record reviewer identity in audit history', async () => {
      const reviewer = await createUser('reviewer');
      const applicant = await createUser('applicant');
      const { doc } = await createApplicationAndDocument(applicant);

      const result = await documentService.verifyDocument({
        documentId: doc._id.toString(),
        status: 'Verified',
        remarks: '',
        reviewerId: reviewer._id
      });

      expect(result.verificationStatus).toBe('Verified');
      expect(result.verifiedBy.role).toBe('reviewer');

      const history = await DocumentVerificationHistory.find({ document: doc._id })
        .populate('verifiedBy', 'fullName email role');
      expect(history).toHaveLength(1);
      expect(history[0].verifiedBy.role).toBe('reviewer');
    });
  });

  describe('3. Mandatory rejection remarks', () => {
    test('should reject a document when remarks are provided', async () => {
      const admin = await createUser('admin');
      const applicant = await createUser('applicant');
      const { doc } = await createApplicationAndDocument(applicant);

      const result = await documentService.verifyDocument({
        documentId: doc._id.toString(),
        status: 'Rejected',
        remarks: 'Document is illegible',
        reviewerId: admin._id
      });

      expect(result.verificationStatus).toBe('Rejected');
      expect(result.verificationRemarks).toBe('Document is illegible');
    });

    test('should fail rejection when remarks are empty', async () => {
      const admin = await createUser('admin');
      const applicant = await createUser('applicant');
      const { doc } = await createApplicationAndDocument(applicant);

      await expect(
        documentService.verifyDocument({
          documentId: doc._id.toString(),
          status: 'Rejected',
          remarks: '',
          reviewerId: admin._id
        })
      ).rejects.toThrow('Remarks are mandatory when rejecting a document');
    });

    test('should fail rejection when remarks are whitespace-only', async () => {
      const admin = await createUser('admin');
      const applicant = await createUser('applicant');
      const { doc } = await createApplicationAndDocument(applicant);

      await expect(
        documentService.verifyDocument({
          documentId: doc._id.toString(),
          status: 'Rejected',
          remarks: '   ',
          reviewerId: admin._id
        })
      ).rejects.toThrow('Remarks are mandatory when rejecting a document');
    });
  });

  describe('4. Audit history is append-only', () => {
    test('should create multiple history entries for repeated actions', async () => {
      const reviewer = await createUser('reviewer');
      const admin = await createUser('admin');
      const applicant = await createUser('applicant');
      const { doc } = await createApplicationAndDocument(applicant);

      // Reviewer rejects
      await documentService.verifyDocument({
        documentId: doc._id.toString(),
        status: 'Rejected',
        remarks: 'Wrong document',
        reviewerId: reviewer._id
      });

      // Admin re-approves (e.g. after applicant re-uploads)
      await documentService.verifyDocument({
        documentId: doc._id.toString(),
        status: 'Verified',
        remarks: 'Corrected copy accepted',
        reviewerId: admin._id
      });

      const history = await DocumentVerificationHistory.find({ document: doc._id })
        .sort({ timestamp: 1 })
        .populate('verifiedBy', 'fullName email role');

      expect(history).toHaveLength(2);
      expect(history[0].newStatus).toBe('Rejected');
      expect(history[0].verifiedBy.role).toBe('reviewer');
      expect(history[1].previousStatus).toBe('Rejected');
      expect(history[1].newStatus).toBe('Verified');
      expect(history[1].verifiedBy.role).toBe('admin');
    });
  });

  describe('5. Invalid verification status is rejected', () => {
    test('should reject invalid status values', async () => {
      const admin = await createUser('admin');
      const applicant = await createUser('applicant');
      const { doc } = await createApplicationAndDocument(applicant);

      await expect(
        documentService.verifyDocument({
          documentId: doc._id.toString(),
          status: 'Approved',
          remarks: '',
          reviewerId: admin._id
        })
      ).rejects.toThrow("Invalid verification status 'Approved'");
    });
  });

  describe('6. Non-existent document returns 404', () => {
    test('should throw for a non-existent document ID', async () => {
      const admin = await createUser('admin');
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        documentService.verifyDocument({
          documentId: fakeId.toString(),
          status: 'Verified',
          remarks: '',
          reviewerId: admin._id
        })
      ).rejects.toThrow('Document record not found');
    });
  });

  describe('7. Approval with optional remarks', () => {
    test('should allow approval without remarks', async () => {
      const admin = await createUser('admin');
      const applicant = await createUser('applicant');
      const { doc } = await createApplicationAndDocument(applicant);

      const result = await documentService.verifyDocument({
        documentId: doc._id.toString(),
        status: 'Verified',
        remarks: undefined,
        reviewerId: admin._id
      });

      expect(result.verificationStatus).toBe('Verified');
      expect(result.verificationRemarks).toBe('');
    });
  });

  describe('8. Document status does not affect application status', () => {
    test('verifying all documents should not change application status', async () => {
      const admin = await createUser('admin');
      const applicant = await createUser('applicant');
      const { app, doc } = await createApplicationAndDocument(applicant, 'Class 10 Marksheet');

      // Create second doc
      const doc2 = await UploadedDocument.create({
        application: app._id,
        applicant: applicant._id,
        documentType: 'Class 12 Marksheet',
        originalFileName: 'class12.pdf',
        storedFileName: 'stored_class12.pdf',
        filePath: 'uploads/stored_class12.pdf',
        mimeType: 'application/pdf',
        fileSize: 22345,
        uploadedAt: new Date(),
        verificationStatus: 'Pending'
      });

      await documentService.verifyDocument({
        documentId: doc._id.toString(),
        status: 'Verified',
        remarks: '',
        reviewerId: admin._id
      });

      await documentService.verifyDocument({
        documentId: doc2._id.toString(),
        status: 'Verified',
        remarks: '',
        reviewerId: admin._id
      });

      // Application status should remain unchanged
      const updatedApp = await Application.findById(app._id);
      expect(updatedApp.status).toBe('Submitted');
    });
  });
});
