const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { User, Application, ApplicationStatusHistory } = require('../models');
const adminService = require('../services/admin.service');

let replSet;
let sequence = 0;

async function createApplication(status = 'Submitted') {
  sequence += 1;
  const applicant = await User.create({
    fullName: `Replica Applicant ${sequence}`,
    email: `stage8.replica.${sequence}@example.com`,
    password: 'Password@123',
    role: 'applicant'
  });

  return Application.create({
    applicationId: `IEM-2026-8${String(sequence).padStart(4, '0')}`,
    applicant: applicant._id,
    academicSession: '2026-2027',
    personalInfo: {
      fullName: `Replica Applicant ${sequence}`,
      dob: new Date('2005-01-01'),
      gender: 'Male',
      email: `stage8.replica.${sequence}@example.com`,
      phone: '9830000001',
      address: 'Salt Lake Sector V',
      state: 'West Bengal',
      city: 'Kolkata',
      pincode: '700091'
    },
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

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(replSet.getUri());
  await User.init();
  await Application.init();
  await ApplicationStatusHistory.init();
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await ApplicationStatusHistory.deleteMany({});
  await Application.deleteMany({});
  await User.deleteMany({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Stage 8: replica-set transaction status updates', () => {
  it('should detect a replica set and use a MongoDB transaction', async () => {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    expect(hello.setName).toBeTruthy();

    const admin = await User.create({
      fullName: 'Replica Administrator',
      email: 'stage8.replica.admin@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    const application = await createApplication('Submitted');

    const startSessionSpy = jest.spyOn(mongoose, 'startSession');

    const result = await adminService.updateApplicationStatus(
      application._id.toString(),
      'Under Review',
      'Transactional review.',
      admin._id
    );

    expect(startSessionSpy).toHaveBeenCalled();
    expect(result.application.status).toBe('Under Review');

    const history = await ApplicationStatusHistory.find({
      application: application._id
    });
    expect(history).toHaveLength(1);
    expect(history[0].previousStatus).toBe('Submitted');
    expect(history[0].newStatus).toBe('Under Review');
  });

  it('should roll back the status update when audit insertion fails inside the transaction', async () => {
    const admin = await User.create({
      fullName: 'Replica Failure Administrator',
      email: 'stage8.replica.failure@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    const application = await createApplication('Submitted');

    jest
      .spyOn(ApplicationStatusHistory, 'create')
      .mockRejectedValueOnce(new Error('Simulated transactional audit failure'));

    await expect(
      adminService.updateApplicationStatus(
        application._id.toString(),
        'Under Review',
        'Should roll back.',
        admin._id
      )
    ).rejects.toThrow('Simulated transactional audit failure');

    const databaseApplication = await Application.findById(application._id);
    expect(databaseApplication.status).toBe('Submitted');
    expect(
      await ApplicationStatusHistory.countDocuments({ application: application._id })
    ).toBe(0);
  });

  it('should allow only one of two concurrent administrator updates', async () => {
    const firstAdmin = await User.create({
      fullName: 'Replica Admin One',
      email: 'stage8.replica.admin1@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    const secondAdmin = await User.create({
      fullName: 'Replica Admin Two',
      email: 'stage8.replica.admin2@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    const application = await createApplication('Submitted');

    const results = await Promise.allSettled([
      adminService.updateApplicationStatus(
        application._id.toString(),
        'Under Review',
        'Admin one',
        firstAdmin._id
      ),
      adminService.updateApplicationStatus(
        application._id.toString(),
        'Under Review',
        'Admin two',
        secondAdmin._id
      )
    ]);

    const fulfilled = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.statusCode).toBe(409);

    const databaseApplication = await Application.findById(application._id);
    expect(databaseApplication.status).toBe('Under Review');

    const history = await ApplicationStatusHistory.find({
      application: application._id
    });
    expect(history).toHaveLength(1);
    expect(history[0].newStatus).toBe('Under Review');
  });
});
