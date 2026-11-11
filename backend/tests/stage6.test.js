const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const { User, Application, ApplicationStatusHistory } = require('../models');

let mongoServer;
let appSequence = 0;

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

function buildPersonalInfo(fullName, email) {
  return {
    fullName,
    dob: new Date('2005-01-01'),
    gender: 'Male',
    email,
    phone: '9830000001',
    address: 'Salt Lake Sector V',
    state: 'West Bengal',
    city: 'Kolkata',
    pincode: '700091'
  };
}

async function createApplicant(fullName, email) {
  return User.create({
    fullName,
    email,
    password: 'Password@123',
    role: 'applicant'
  });
}

async function createApplication({ applicant, status = 'Submitted', applicationId } = {}) {
  appSequence += 1;
  const candidate =
    applicant ||
    (await createApplicant(
      `Stage Six Applicant ${appSequence}`,
      `stage6.applicant.${appSequence}@example.com`
    ));

  return Application.create({
    applicationId: applicationId || `IEM-2026-9${String(appSequence).padStart(4, '0')}`,
    applicant: candidate._id,
    academicSession: '2026-2027',
    personalInfo: buildPersonalInfo(
      `Stage Six Applicant ${appSequence}`,
      `stage6.applicant.${appSequence}@example.com`
    ),
    academicInfo: {
      class10Board: 'CBSE',
      class10Percentage: 90,
      class12Board: 'CBSE',
      class12Percentage: 91,
      class12PassingYear: 2024,
      entranceExamName: 'WBJEE',
      entranceExamScore: 'Rank 1200'
    },
    admissionInfo: {
      preferredDepartment: 'Computer Science & Engineering',
      admissionCategory: 'General'
    },
    status,
    submittedAt: new Date()
  });
}

function validSubmissionPayload(fullName, email) {
  return {
    academicSession: '2026-2027',
    personalInfo: {
      fullName,
      dob: '2005-04-12',
      gender: 'Male',
      email,
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
      preferredDepartment: 'Information Technology',
      admissionCategory: 'General'
    }
  };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await User.init();
  await Application.init();
  await ApplicationStatusHistory.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  appSequence = 0;
  await ApplicationStatusHistory.deleteMany({});
  await Application.deleteMany({});
  await User.deleteMany({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Stage 6: Application Status Workflow & Audit History', () => {
  let adminUser, adminToken;
  let secondAdmin, secondAdminToken;
  let applicantUser, applicantToken;

  beforeEach(async () => {
    adminUser = await User.create({
      fullName: 'Admissions Administrator',
      email: 'stage6.admin@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser);

    secondAdmin = await User.create({
      fullName: 'Second Admissions Administrator',
      email: 'stage6.admin2@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    secondAdminToken = generateTestToken(secondAdmin);

    applicantUser = await createApplicant('Stage Six Applicant', 'stage6.applicant@example.com');
    applicantToken = generateTestToken(applicantUser);
  });

  function patchStatus(applicationId, body, token = adminToken) {
    const req = request(app).patch(`/api/admin/applications/${applicationId}/status`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  }

  describe('Valid workflow transitions', () => {
    it('should allow Submitted -> Under Review and record exactly one audit entry', async () => {
      const application = await createApplication({ status: 'Submitted' });

      const res = await patchStatus(application._id, {
        status: 'Under Review',
        remarks: 'Documents received and forwarded for review.'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.previousStatus).toBe('Submitted');
      expect(res.body.data.newStatus).toBe('Under Review');
      expect(res.body.data.application.status).toBe('Under Review');
      expect(res.body.data.allowedNextStatuses).toEqual(['Selected', 'Rejected']);

      const dbApplication = await Application.findById(application._id);
      expect(dbApplication.status).toBe('Under Review');

      const history = await ApplicationStatusHistory.find({ application: application._id });
      expect(history).toHaveLength(1);
      expect(history[0].previousStatus).toBe('Submitted');
      expect(history[0].newStatus).toBe('Under Review');
      expect(history[0].changedBy.toString()).toBe(adminUser._id.toString());
      expect(history[0].remarks).toBe('Documents received and forwarded for review.');
    });

    it('should allow Under Review -> Selected and make Selected terminal', async () => {
      const application = await createApplication({ status: 'Under Review' });

      const res = await patchStatus(application._id, {
        status: 'Selected',
        remarks: 'Merit rank qualifies for admission.'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.application.status).toBe('Selected');
      expect(res.body.data.allowedNextStatuses).toEqual([]);

      const history = await ApplicationStatusHistory.find({ application: application._id });
      expect(history).toHaveLength(1);
      expect(history[0].previousStatus).toBe('Under Review');
      expect(history[0].newStatus).toBe('Selected');
    });

    it('should allow Under Review -> Rejected and make Rejected terminal', async () => {
      const application = await createApplication({ status: 'Under Review' });

      const res = await patchStatus(application._id, {
        status: 'Rejected',
        remarks: 'Seat capacity exhausted for the selected stream.'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.application.status).toBe('Rejected');
      expect(res.body.data.allowedNextStatuses).toEqual([]);

      const history = await ApplicationStatusHistory.find({ application: application._id });
      expect(history).toHaveLength(1);
      expect(history[0].previousStatus).toBe('Under Review');
      expect(history[0].newStatus).toBe('Rejected');
    });
  });

  describe('Invalid transitions and invalid input', () => {
    const invalidCases = [
      ['Submitted', 'Selected'],
      ['Submitted', 'Rejected'],
      ['Selected', 'Rejected'],
      ['Rejected', 'Selected'],
      ['Selected', 'Under Review'],
      ['Selected', 'Submitted'],
      ['Selected', 'Selected'],
      ['Rejected', 'Under Review'],
      ['Rejected', 'Submitted'],
      ['Rejected', 'Rejected'],
      ['Under Review', 'Submitted'],
      ['Under Review', 'Under Review'],
      ['Submitted', 'Approved'],
      ['Under Review', 'under review']
    ];

    it.each(invalidCases)(
      'should reject %s -> %s with HTTP 400 and create no audit record',
      async (currentStatus, requestedStatus) => {
        const application = await createApplication({ status: currentStatus });

        const res = await patchStatus(application._id, { status: requestedStatus });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);

        const dbApplication = await Application.findById(application._id);
        expect(dbApplication.status).toBe(currentStatus);
        expect(await ApplicationStatusHistory.countDocuments({ application: application._id })).toBe(0);
      }
    );

    it('should reject a missing status field', async () => {
      const application = await createApplication({ status: 'Submitted' });

      const res = await patchStatus(application._id, { remarks: 'No status supplied' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect((await Application.findById(application._id)).status).toBe('Submitted');
    });

    it('should return 404 for a non-existent application', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await patchStatus(fakeId, { status: 'Under Review' });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should gracefully reject a malformed application ID with HTTP 400', async () => {
      const res = await patchStatus('not-a-valid-object-id', { status: 'Under Review' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Authorization and identity security', () => {
    it('should return 401 for an unauthenticated status update', async () => {
      const application = await createApplication({ status: 'Submitted' });

      const res = await patchStatus(application._id, { status: 'Under Review' }, null);

      expect(res.statusCode).toBe(401);
      expect((await Application.findById(application._id)).status).toBe('Submitted');
      expect(await ApplicationStatusHistory.countDocuments({ application: application._id })).toBe(0);
    });

    it('should return 403 when an applicant attempts a status update', async () => {
      const application = await createApplication({
        applicant: applicantUser,
        status: 'Submitted',
        applicationId: 'IEM-2026-90001'
      });

      const res = await patchStatus(application._id, { status: 'Under Review' }, applicantToken);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect((await Application.findById(application._id)).status).toBe('Submitted');
      expect(await ApplicationStatusHistory.countDocuments({ application: application._id })).toBe(0);
    });

    it('should allow an authenticated administrator to update an eligible application', async () => {
      const application = await createApplication({ status: 'Submitted' });

      const res = await patchStatus(application._id, { status: 'Under Review' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.application.status).toBe('Under Review');
    });

    it('should ignore client-supplied changedBy, previousStatus and applicant identity', async () => {
      const application = await createApplication({
        applicant: applicantUser,
        status: 'Submitted',
        applicationId: 'IEM-2026-90002'
      });

      const res = await patchStatus(application._id, {
        status: 'Under Review',
        remarks: 'Legitimate review note.',
        changedBy: secondAdmin._id.toString(),
        previousStatus: 'Selected',
        applicant: secondAdmin._id.toString(),
        newStatus: 'Selected'
      });

      expect(res.statusCode).toBe(200);

      const history = await ApplicationStatusHistory.findOne({ application: application._id });
      expect(history.changedBy.toString()).toBe(adminUser._id.toString());
      expect(history.changedBy.toString()).not.toBe(secondAdmin._id.toString());
      expect(history.previousStatus).toBe('Submitted');
      expect(history.newStatus).toBe('Under Review');
      expect(history.remarks).toBe('Legitimate review note.');

      const dbApplication = await Application.findById(application._id);
      expect(dbApplication.status).toBe('Under Review');
      expect(dbApplication.applicant.toString()).toBe(applicantUser._id.toString());
    });

    it('should not allow applicants to change status through submission or retrieval endpoints', async () => {
      const submission = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          ...validSubmissionPayload('Applicant Submission Guard', 'stage6.guard@example.com'),
          status: 'Selected',
          applicant: adminUser._id.toString()
        });

      expect(submission.statusCode).toBe(201);
      expect(submission.body.data.status).toBe('Submitted');
      expect(submission.body.data.applicant).toBe(applicantUser._id.toString());

      const applicationId = submission.body.data._id;

      const retrieval = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(retrieval.statusCode).toBe(200);
      expect(retrieval.body.data.status).toBe('Submitted');

      const applicantPatch = await request(app)
        .patch(`/api/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ status: 'Selected' });

      expect(applicantPatch.statusCode).toBe(404);
      expect((await Application.findById(applicationId)).status).toBe('Submitted');
    });
  });

  describe('Audit history integrity', () => {
    it('should create exactly one history record per successful transition and preserve previous entries', async () => {
      const application = await createApplication({ status: 'Submitted' });

      await patchStatus(application._id, { status: 'Under Review', remarks: 'First review' });
      expect(await ApplicationStatusHistory.countDocuments({ application: application._id })).toBe(1);

      await patchStatus(application._id, { status: 'Selected', remarks: 'Final selection' });
      expect(await ApplicationStatusHistory.countDocuments({ application: application._id })).toBe(2);

      const history = await ApplicationStatusHistory.find({ application: application._id }).sort({
        timestamp: 1
      });

      expect(history.map(entry => entry.previousStatus)).toEqual(['Submitted', 'Under Review']);
      expect(history.map(entry => entry.newStatus)).toEqual(['Under Review', 'Selected']);
      expect(history.map(entry => entry.remarks)).toEqual(['First review', 'Final selection']);
      history.forEach(entry => {
        expect(entry.changedBy.toString()).toBe(adminUser._id.toString());
      });
    });

    it('should keep the initial applicant submission entry intact and distinguish it from admin actions', async () => {
      const submission = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(validSubmissionPayload('Initial History Applicant', 'stage6.initial@example.com'));

      expect(submission.statusCode).toBe(201);
      const applicationId = submission.body.data._id;

      const update = await patchStatus(applicationId, {
        status: 'Under Review',
        remarks: 'Administrator started review.'
      });
      expect(update.statusCode).toBe(200);

      const history = await ApplicationStatusHistory.find({ application: applicationId })
        .sort({ timestamp: 1 })
        .populate('changedBy', 'fullName role');

      expect(history).toHaveLength(2);

      const submissionEntry = history.find(entry => entry.changedBy.role === 'applicant');
      expect(submissionEntry).toBeDefined();
      expect(submissionEntry.previousStatus).toBe('Submitted');
      expect(submissionEntry.newStatus).toBe('Submitted');
      expect(submissionEntry.changedBy._id.toString()).toBe(applicantUser._id.toString());
      expect(submissionEntry.remarks).toBe('Application submitted by candidate');

      const adminEntry = history.find(entry => entry.changedBy.role === 'admin');
      expect(adminEntry).toBeDefined();
      expect(adminEntry.previousStatus).toBe('Submitted');
      expect(adminEntry.newStatus).toBe('Under Review');
      expect(adminEntry.changedBy._id.toString()).toBe(adminUser._id.toString());
      expect(adminEntry.remarks).toBe('Administrator started review.');
    });

    it('should not create audit records for failed transitions', async () => {
      const application = await createApplication({ status: 'Selected' });

      const res = await patchStatus(application._id, { status: 'Rejected' });

      expect(res.statusCode).toBe(400);
      expect(await ApplicationStatusHistory.countDocuments({ application: application._id })).toBe(0);
    });

    it('should roll back the audit record when the application update fails', async () => {
      const application = await createApplication({ status: 'Submitted' });

      jest
        .spyOn(Application, 'findOneAndUpdate')
        .mockRejectedValueOnce(new Error('Simulated database update failure'));

      const res = await patchStatus(application._id, { status: 'Under Review' });

      expect(res.statusCode).toBe(500);
      expect((await Application.findById(application._id)).status).toBe('Submitted');
      expect(await ApplicationStatusHistory.countDocuments({ application: application._id })).toBe(0);
    });

    it('should not change status when audit history creation fails', async () => {
      const application = await createApplication({ status: 'Submitted' });

      jest
        .spyOn(ApplicationStatusHistory, 'create')
        .mockRejectedValueOnce(new Error('Simulated audit history failure'));

      const res = await patchStatus(application._id, { status: 'Under Review' });

      expect(res.statusCode).toBe(500);
      expect((await Application.findById(application._id)).status).toBe('Submitted');
      expect(await ApplicationStatusHistory.countDocuments({ application: application._id })).toBe(0);
    });

    it('should expose chronological history and permitted next statuses in admin details', async () => {
      const application = await createApplication({ status: 'Submitted' });

      await patchStatus(application._id, { status: 'Under Review', remarks: 'Review started.' });

      const res = await request(app)
        .get(`/api/admin/applications/${application._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('Under Review');
      expect(res.body.data.allowedNextStatuses).toEqual(['Selected', 'Rejected']);
      expect(res.body.data.statusHistory).toHaveLength(1);
      expect(res.body.data.statusHistory[0].changedBy.fullName).toBe('Admissions Administrator');
      expect(res.body.data.statusHistory[0].changedBy.role).toBe('admin');
    });
  });

  describe('Concurrency safety', () => {
    it('should allow only one of two simultaneous identical updates and create one audit record', async () => {
      const application = await createApplication({ status: 'Submitted' });

      const [first, second] = await Promise.all([
        patchStatus(application._id, { status: 'Under Review', remarks: 'Admin one update' }),
        patchStatus(application._id, { status: 'Under Review', remarks: 'Admin two update' })
      ]);

      const statusCodes = [first.statusCode, second.statusCode].sort((a, b) => a - b);
      expect(statusCodes).toEqual([200, 409]);

      const dbApplication = await Application.findById(application._id);
      expect(dbApplication.status).toBe('Under Review');

      const history = await ApplicationStatusHistory.find({ application: application._id });
      expect(history).toHaveLength(1);
      expect(history[0].previousStatus).toBe('Submitted');
      expect(history[0].newStatus).toBe('Under Review');
    });

    it('should not create conflicting histories for simultaneous Selected/Rejected updates', async () => {
      const application = await createApplication({ status: 'Under Review' });

      const [selectedRes, rejectedRes] = await Promise.all([
        patchStatus(application._id, { status: 'Selected', remarks: 'Select candidate' }),
        patchStatus(application._id, { status: 'Rejected', remarks: 'Reject candidate' })
      ]);

      const statusCodes = [selectedRes.statusCode, rejectedRes.statusCode].sort((a, b) => a - b);
      expect(statusCodes).toEqual([200, 409]);

      const dbApplication = await Application.findById(application._id);
      expect(['Selected', 'Rejected']).toContain(dbApplication.status);

      const history = await ApplicationStatusHistory.find({ application: application._id });
      expect(history).toHaveLength(1);
      expect(history[0].previousStatus).toBe('Under Review');
      expect(history[0].newStatus).toBe(dbApplication.status);
    });
  });
});
