const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const {
  User,
  Application,
  UploadedDocument,
  ApplicationStatusHistory
} = require('../models');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  // Ensure indexes are built
  await User.init();
  await Application.init();
  await UploadedDocument.init();
  await ApplicationStatusHistory.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clean up collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Stage 1: System Foundation & Database Schema Validation', () => {
  describe('API Health Endpoint', () => {
    it('should return 200 and healthy status when database is connected', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.database).toBe('connected');
    });

    it('should return 404 with standard error structure for unknown endpoints', async () => {
      const res = await request(app).get('/api/invalid-route');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Endpoint not found');
    });
  });

  describe('User Model', () => {
    it('should create and hash password with bcrypt', async () => {
      const rawPassword = 'SecretPassword123!';
      const user = await User.create({
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        password: rawPassword,
        role: 'applicant',
        phone: '9876543210'
      });

      expect(user._id).toBeDefined();
      expect(user.password).not.toBe(rawPassword);
      expect(await user.comparePassword(rawPassword)).toBe(true);
      expect(await user.comparePassword('WrongPassword')).toBe(false);

      // Verify toJSON omits password
      const jsonUser = user.toJSON();
      expect(jsonUser.password).toBeUndefined();
    });

    it('should reject user creation with duplicate email', async () => {
      await User.create({
        fullName: 'User One',
        email: 'duplicate@example.com',
        password: 'Password123'
      });

      await expect(
        User.create({
          fullName: 'User Two',
          email: 'duplicate@example.com',
          password: 'Password456'
        })
      ).rejects.toThrow();
    });

    it('should reject invalid role enum', async () => {
      await expect(
        User.create({
          fullName: 'Invalid Role User',
          email: 'invalid-role@example.com',
          password: 'Password123',
          role: 'superadmin'
        })
      ).rejects.toThrow();
    });
  });

  describe('Application Model', () => {
    let testApplicant;

    beforeEach(async () => {
      testApplicant = await User.create({
        fullName: 'Applicant One',
        email: 'applicant1@example.com',
        password: 'Password123',
        role: 'applicant'
      });
    });

    it('should create a valid application with complete information', async () => {
      const applicationData = {
        applicationId: 'IEM-2026-00001',
        applicant: testApplicant._id,
        academicSession: '2026-2027',
        personalInfo: {
          fullName: 'Applicant One',
          dob: new Date('2005-05-15'),
          gender: 'Male',
          email: 'applicant1@example.com',
          phone: '9876543210',
          address: '123 Salt Lake Sector V',
          state: 'West Bengal',
          city: 'Kolkata',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'ICSE',
          class10Percentage: 92.5,
          class12Board: 'ISC',
          class12Percentage: 94.0,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceExamScore: 'Rank 1250'
        },
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        }
      };

      const application = await Application.create(applicationData);
      expect(application._id).toBeDefined();
      expect(application.status).toBe('Submitted');
      expect(application.applicationId).toBe('IEM-2026-00001');
    });

    it('should prevent duplicate applications for the same applicant and academic session', async () => {
      const baseApp = {
        applicant: testApplicant._id,
        academicSession: '2026-2027',
        personalInfo: {
          fullName: 'Applicant One',
          dob: new Date('2005-05-15'),
          gender: 'Male',
          email: 'applicant1@example.com',
          phone: '9876543210',
          address: '123 Salt Lake',
          state: 'West Bengal',
          city: 'Kolkata',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'ICSE',
          class10Percentage: 90,
          class12Board: 'ISC',
          class12Percentage: 90,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceExamScore: '1500'
        },
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        }
      };

      await Application.create({ ...baseApp, applicationId: 'IEM-2026-11111' });

      await expect(
        Application.create({ ...baseApp, applicationId: 'IEM-2026-22222' })
      ).rejects.toThrow();
    });

    it('should reject application with invalid percentage or category', async () => {
      const invalidApp = {
        applicationId: 'IEM-2026-99999',
        applicant: testApplicant._id,
        academicSession: '2026-2027',
        personalInfo: {
          fullName: 'Applicant One',
          dob: new Date('2005-05-15'),
          gender: 'Male',
          email: 'applicant1@example.com',
          phone: '9876543210',
          address: '123 Salt Lake',
          state: 'West Bengal',
          city: 'Kolkata',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'ICSE',
          class10Percentage: 110, // Invalid: exceeds 100
          class12Board: 'ISC',
          class12Percentage: 88,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceExamScore: '1500'
        },
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'InvalidCategory'
        }
      };

      await expect(Application.create(invalidApp)).rejects.toThrow();
    });
  });

  describe('UploadedDocument Model', () => {
    it('should create document metadata linked to application and applicant', async () => {
      const applicant = await User.create({
        fullName: 'Student Doe',
        email: 'student@example.com',
        password: 'Password123'
      });

      const application = await Application.create({
        applicationId: 'IEM-2026-00002',
        applicant: applicant._id,
        academicSession: '2026-2027',
        personalInfo: {
          fullName: 'Student Doe',
          dob: new Date('2005-01-01'),
          gender: 'Female',
          email: 'student@example.com',
          phone: '9999988888',
          address: 'Address 1',
          state: 'WB',
          city: 'Kolkata',
          pincode: '700001'
        },
        academicInfo: {
          class10Board: 'CBSE',
          class10Percentage: 95,
          class12Board: 'CBSE',
          class12Percentage: 93,
          class12PassingYear: 2024,
          entranceExamName: 'JEE Main',
          entranceExamScore: '98.5 percentile'
        },
        admissionInfo: {
          preferredDepartment: 'Information Technology',
          admissionCategory: 'General'
        }
      });

      const doc = await UploadedDocument.create({
        application: application._id,
        applicant: applicant._id,
        documentType: 'Class 12 Marksheet',
        originalFileName: 'class12_marksheet.pdf',
        storedFileName: '1720000000-class12_marksheet.pdf',
        filePath: 'uploads/documents/1720000000-class12_marksheet.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024500
      });

      expect(doc._id).toBeDefined();
      expect(doc.documentType).toBe('Class 12 Marksheet');
      expect(doc.application.toString()).toBe(application._id.toString());
    });
  });

  describe('ApplicationStatusHistory Model', () => {
    it('should record status transition with admin reference and remarks', async () => {
      const admin = await User.create({
        fullName: 'Admissions Officer',
        email: 'officer@iem.edu',
        password: 'Password123',
        role: 'admin'
      });

      const applicant = await User.create({
        fullName: 'Applicant Three',
        email: 'applicant3@example.com',
        password: 'Password123'
      });

      const application = await Application.create({
        applicationId: 'IEM-2026-00003',
        applicant: applicant._id,
        academicSession: '2026-2027',
        personalInfo: {
          fullName: 'Applicant Three',
          dob: new Date('2005-02-02'),
          gender: 'Female',
          email: 'applicant3@example.com',
          phone: '9876543219',
          address: 'Address',
          state: 'WB',
          city: 'Kolkata',
          pincode: '700001'
        },
        academicInfo: {
          class10Board: 'CBSE',
          class10Percentage: 88,
          class12Board: 'CBSE',
          class12Percentage: 91,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceExamScore: '1800'
        },
        admissionInfo: {
          preferredDepartment: 'Electronics & Communication Engineering',
          admissionCategory: 'OBC'
        }
      });

      const history = await ApplicationStatusHistory.create({
        application: application._id,
        previousStatus: 'Submitted',
        newStatus: 'Under Review',
        changedBy: admin._id,
        remarks: 'Initial academic credentials verified.'
      });

      expect(history._id).toBeDefined();
      expect(history.previousStatus).toBe('Submitted');
      expect(history.newStatus).toBe('Under Review');
      expect(history.remarks).toBe('Initial academic credentials verified.');
      expect(history.changedBy.toString()).toBe(admin._id.toString());
    });
  });
});
