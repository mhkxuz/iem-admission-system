const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const { User } = require('../models');
const seedAdmin = require('../scripts/seed-admin');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await User.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Stage 2: Authentication & Role-Based Access Control (RBAC)', () => {
  describe('POST /api/auth/register', () => {
    it('should successfully register a new applicant user and return JWT token', async () => {
      const payload = {
        fullName: 'Aritra Mukherjee',
        email: 'aritra@example.com',
        password: 'Password@123',
        phone: '9876543210'
      };

      const res = await request(app).post('/api/auth/register').send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('aritra@example.com');
      expect(res.body.data.user.role).toBe('applicant');

      // Password security check: Never exposed in API response
      expect(res.body.data.user.password).toBeUndefined();

      // Database verification
      const dbUser = await User.findOne({ email: 'aritra@example.com' }).select('+password');
      expect(dbUser).not.toBeNull();
      expect(dbUser.password).not.toBe(payload.password);
      expect(await dbUser.comparePassword(payload.password)).toBe(true);
    });

    it('should strictly force role to applicant even if client sends role: admin', async () => {
      const exploitPayload = {
        fullName: 'Hacker User',
        email: 'hacker@example.com',
        password: 'Password@123',
        role: 'admin' // Attempted privilege escalation
      };

      const res = await request(app).post('/api/auth/register').send(exploitPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.user.role).toBe('applicant');

      const dbUser = await User.findOne({ email: 'hacker@example.com' });
      expect(dbUser.role).toBe('applicant');
    });

    it('should reject registration when email is already in use', async () => {
      await User.create({
        fullName: 'Existing User',
        email: 'existing@example.com',
        password: 'ExistingPassword123'
      });

      const res = await request(app).post('/api/auth/register').send({
        fullName: 'Duplicate User',
        email: 'existing@example.com',
        password: 'Password@123'
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject registration when required fields are missing or invalid', async () => {
      const invalidRequests = [
        { email: 'bad@test.com', password: 'ValidPassword123' }, // missing fullName
        { fullName: 'Test Name', email: 'invalid-email', password: 'ValidPassword123' }, // bad email
        { fullName: 'Test Name', email: 'valid@test.com', password: '123' } // short password
      ];

      for (const reqPayload of invalidRequests) {
        const res = await request(app).post('/api/auth/register').send(reqPayload);
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        fullName: 'Registered Student',
        email: 'student@iem.edu',
        password: 'SecurePassword123',
        role: 'applicant'
      });
    });

    it('should successfully authenticate user with correct credentials and return JWT', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'student@iem.edu',
        password: 'SecurePassword123'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('student@iem.edu');
      expect(res.body.data.user.role).toBe('applicant');
      expect(res.body.data.user.password).toBeUndefined();

      // Verify token payload
      const decoded = jwt.verify(res.body.data.token, config.jwtSecret);
      expect(decoded.email).toBe('student@iem.edu');
      expect(decoded.role).toBe('applicant');
    });

    it('should reject login when password is incorrect', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'student@iem.edu',
        password: 'WrongPassword'
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should reject login when email does not exist', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@iem.edu',
        password: 'SecurePassword123'
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should reject login request missing email or password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'student@iem.edu'
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('JWT Authentication Middleware (GET /api/auth/me)', () => {
    let validToken;
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        fullName: 'Auth Test User',
        email: 'authtest@iem.edu',
        password: 'Password123',
        role: 'applicant'
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'authtest@iem.edu',
        password: 'Password123'
      });
      validToken = loginRes.body.data.token;
    });

    it('should allow access and return current user profile with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('authtest@iem.edu');
      expect(res.body.data.password).toBeUndefined();
    });

    it('should reject requests without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authentication required');
    });

    it('should reject requests with invalid or tampered token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid authentication token');
    });

    it('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { id: testUser._id.toString(), role: testUser.role },
        config.jwtSecret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('expired');
    });
  });

  describe('Role-Based Access Control Middleware (RBAC)', () => {
    let applicantToken;
    let adminToken;

    beforeEach(async () => {
      const applicant = await User.create({
        fullName: 'Applicant User',
        email: 'applicant@iem.edu',
        password: 'Password123',
        role: 'applicant'
      });

      const admin = await User.create({
        fullName: 'Admin User',
        email: 'admin@iem.edu',
        password: 'Password123',
        role: 'admin'
      });

      applicantToken = jwt.sign(
        { id: applicant._id.toString(), role: applicant.role },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      adminToken = jwt.sign(
        { id: admin._id.toString(), role: admin.role },
        config.jwtSecret,
        { expiresIn: '1h' }
      );
    });

    it('should permit admin to access admin-only endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/test-admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Admin authorization verified');
    });

    it('should forbid applicant from accessing admin-only endpoint (403)', async () => {
      const res = await request(app)
        .get('/api/auth/test-admin')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should permit applicant to access applicant-only endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/test-applicant')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should forbid admin from accessing applicant-only endpoint (403)', async () => {
      const res = await request(app)
        .get('/api/auth/test-applicant')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Admin Seeding Script', () => {
    it('should successfully provision an admin account and allow login', async () => {
      process.env.ADMIN_EMAIL = 'superadmin@iem.edu';
      process.env.ADMIN_PASSWORD = 'SuperAdminSecret@2026';
      process.env.ADMIN_NAME = 'Head of Admissions';

      await seedAdmin();

      const admin = await User.findOne({ email: 'superadmin@iem.edu' }).select('+password');
      expect(admin).not.toBeNull();
      expect(admin.role).toBe('admin');
      expect(admin.fullName).toBe('Head of Admissions');

      // Verify login with seeded credentials
      const res = await request(app).post('/api/auth/login').send({
        email: 'superadmin@iem.edu',
        password: 'SuperAdminSecret@2026'
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.role).toBe('admin');
    });
  });
});
