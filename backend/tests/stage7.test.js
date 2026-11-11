const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const { User, Application } = require('../models');
const dashboardStatistics = require('../services/dashboard-statistics.service');

let mongoServer;
let sequence = 0;

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

async function createApplication({
  status = 'Submitted',
  department = 'Computer Science & Engineering',
  category = 'General'
} = {}) {
  sequence += 1;
  const fullName = `Stage Seven Applicant ${sequence}`;
  const email = `stage7.applicant.${sequence}@example.com`;

  const applicant = await User.create({
    fullName,
    email,
    password: 'Password@123',
    role: 'applicant'
  });

  return Application.create({
    applicationId: `IEM-2026-7${String(sequence).padStart(4, '0')}`,
    applicant: applicant._id,
    academicSession: '2026-2027',
    personalInfo: buildPersonalInfo(fullName, email),
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
      preferredDepartment: department,
      admissionCategory: category
    },
    status,
    submittedAt: new Date()
  });
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await User.init();
  await Application.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Application.deleteMany({});
  await User.deleteMany({});
});

describe('Stage 7: MongoDB aggregation dashboard statistics', () => {
  it('should return zero counts and explicit zero statuses for an empty database', async () => {
    const stats = await dashboardStatistics.getDashboardStatistics();

    expect(stats.metrics).toEqual({
      totalApplications: 0,
      submitted: 0,
      underReview: 0,
      selected: 0,
      rejected: 0
    });

    expect(stats.statusDistribution).toEqual([
      { status: 'Submitted', count: 0 },
      { status: 'Under Review', count: 0 },
      { status: 'Selected', count: 0 },
      { status: 'Rejected', count: 0 }
    ]);

    expect(stats.departmentDistribution).toEqual([]);
    expect(stats.categoryDistribution).toEqual([]);
  });

  it('should aggregate every status, department and category from mixed application data', async () => {
    await createApplication({
      status: 'Submitted',
      department: 'Computer Science & Engineering',
      category: 'General'
    });
    await createApplication({
      status: 'Submitted',
      department: 'Information Technology',
      category: 'SC'
    });
    await createApplication({
      status: 'Under Review',
      department: 'Computer Science & Engineering',
      category: 'General'
    });
    await createApplication({
      status: 'Under Review',
      department: 'Mechanical Engineering',
      category: 'Management'
    });
    await createApplication({
      status: 'Selected',
      department: 'Computer Science & Engineering',
      category: 'OBC'
    });
    await createApplication({
      status: 'Rejected',
      department: 'Information Technology',
      category: 'General'
    });

    const stats = await dashboardStatistics.getDashboardStatistics();

    expect(stats.metrics).toEqual({
      totalApplications: 6,
      submitted: 2,
      underReview: 2,
      selected: 1,
      rejected: 1
    });

    expect(stats.statusDistribution).toEqual([
      { status: 'Submitted', count: 2 },
      { status: 'Under Review', count: 2 },
      { status: 'Selected', count: 1 },
      { status: 'Rejected', count: 1 }
    ]);

    expect(stats.departmentDistribution).toEqual([
      { department: 'Computer Science & Engineering', count: 3 },
      { department: 'Information Technology', count: 2 },
      { department: 'Mechanical Engineering', count: 1 }
    ]);

    expect(stats.categoryDistribution).toEqual([
      { category: 'General', count: 3 },
      { category: 'Management', count: 1 },
      { category: 'OBC', count: 1 },
      { category: 'SC', count: 1 }
    ]);
  });

  it('should represent statuses with no matching applications as zero', async () => {
    await createApplication({ status: 'Submitted' });
    await createApplication({ status: 'Submitted' });

    const stats = await dashboardStatistics.getDashboardStatistics();

    const byStatus = Object.fromEntries(
      stats.statusDistribution.map(entry => [entry.status, entry.count])
    );

    expect(stats.metrics.totalApplications).toBe(2);
    expect(byStatus).toEqual({
      Submitted: 2,
      'Under Review': 0,
      Selected: 0,
      Rejected: 0
    });
  });

  it('should match the results of direct MongoDB $group operations', async () => {
    await createApplication({
      status: 'Selected',
      department: 'Biotechnology',
      category: 'EWS'
    });
    await createApplication({
      status: 'Rejected',
      department: 'Biotechnology',
      category: 'EWS'
    });
    await createApplication({
      status: 'Under Review',
      department: 'Electrical Engineering',
      category: 'ST'
    });

    const stats = await dashboardStatistics.getDashboardStatistics();

    const [directTotal] = await Application.aggregate([
      { $match: {} },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    const directDepartments = await Application.aggregate([
      { $group: { _id: '$admissionInfo.preferredDepartment', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }
    ]);
    const directCategories = await Application.aggregate([
      { $group: { _id: '$admissionInfo.admissionCategory', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }
    ]);

    expect(stats.metrics.totalApplications).toBe(directTotal.count);
    expect(stats.departmentDistribution).toEqual(
      directDepartments.map(row => ({ department: row._id, count: row.count }))
    );
    expect(stats.categoryDistribution).toEqual(
      directCategories.map(row => ({ category: row._id, count: row.count }))
    );
  });

  it('should execute real aggregation pipelines containing $match and $group stages', async () => {
    await createApplication({ status: 'Submitted' });

    const aggregateSpy = jest.spyOn(Application, 'aggregate');

    try {
      await dashboardStatistics.getDashboardStatistics();

      expect(aggregateSpy).toHaveBeenCalledTimes(4);

      const pipelines = aggregateSpy.mock.calls.map(call => call[0]);

      pipelines.forEach(pipeline => {
        expect(Array.isArray(pipeline)).toBe(true);
        expect(pipeline.some(stage => Object.prototype.hasOwnProperty.call(stage, '$match'))).toBe(
          true
        );
        expect(pipeline.some(stage => Object.prototype.hasOwnProperty.call(stage, '$group'))).toBe(
          true
        );
      });
    } finally {
      aggregateSpy.mockRestore();
    }
  });

  it('should expose aggregation results through GET /api/admin/dashboard for administrators', async () => {
    await createApplication({
      status: 'Under Review',
      department: 'Computer Science & Engineering',
      category: 'General'
    });
    await createApplication({
      status: 'Selected',
      department: 'Information Technology',
      category: 'OBC'
    });

    const admin = await User.create({
      fullName: 'Stage Seven Administrator',
      email: 'stage7.admin@iem.edu',
      password: 'AdminPassword@123',
      role: 'admin'
    });
    const token = generateTestToken(admin);

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics.totalApplications).toBe(2);
    expect(res.body.data.statusDistribution).toEqual([
      { status: 'Submitted', count: 0 },
      { status: 'Under Review', count: 1 },
      { status: 'Selected', count: 1 },
      { status: 'Rejected', count: 0 }
    ]);
    expect(res.body.data.departmentDistribution).toEqual([
      { department: 'Computer Science & Engineering', count: 1 },
      { department: 'Information Technology', count: 1 }
    ]);
    expect(res.body.data.categoryDistribution).toEqual([
      { category: 'General', count: 1 },
      { category: 'OBC', count: 1 }
    ]);
  });

  it('should reject unauthenticated dashboard statistics requests with 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should forbid applicants from reading admin dashboard statistics with 403', async () => {
    const applicant = await User.create({
      fullName: 'Stage Seven Applicant User',
      email: 'stage7.blocked.applicant@example.com',
      password: 'Password@123',
      role: 'applicant'
    });
    const token = generateTestToken(applicant);

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Forbidden');
  });
});
