const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const config = require('../config/config');
const {
  User,
  Application,
  UploadedDocument,
  AcademicSession,
  Programme,
  FeeStructure,
  MeritList,
  SeatAllocation,
  Payment,
  Enrolment,
  Notification
} = require('../models');

let mongoServer;

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

describe('Upgrade Stage 4: Admission Confirmation, Payment & Enrolment Tests', () => {
  let adminUser, reviewerUser, applicantUser, waitlistedApplicantUser;
  let adminToken, reviewerToken, applicantToken, waitlistedToken;
  let session, programme, feeStructure;
  let applicantApp, waitlistedApp;
  let publishedAllocation;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create Admin User
    adminUser = await User.create({
      fullName: 'Chief Admissions Officer',
      email: 'admin.stage4@iem.edu',
      password: 'Password123!',
      role: 'admin',
      isEmailVerified: true
    });
    adminToken = generateTestToken(adminUser);

    // Create Reviewer User
    reviewerUser = await User.create({
      fullName: 'Document Reviewer',
      email: 'reviewer.stage4@iem.edu',
      password: 'Password123!',
      role: 'reviewer',
      isEmailVerified: true
    });
    reviewerToken = generateTestToken(reviewerUser);

    // Create Eligible Applicant User
    applicantUser = await User.create({
      fullName: 'Siddharth Sen',
      email: 'siddharth.stage4@iem.edu',
      password: 'Password123!',
      role: 'applicant',
      isEmailVerified: true
    });
    applicantToken = generateTestToken(applicantUser);

    // Create Waitlisted Applicant User
    waitlistedApplicantUser = await User.create({
      fullName: 'Rahul Roy',
      email: 'rahul.stage4@iem.edu',
      password: 'Password123!',
      role: 'applicant',
      isEmailVerified: true
    });
    waitlistedToken = generateTestToken(waitlistedApplicantUser);

    // Create Active Academic Session
    session = await AcademicSession.create({
      sessionCode: '2026-2027',
      sessionName: '2026-2027',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isActive: true,
      isAdmissionOpen: true
    });

    // Create B.Tech CSE Programme
    programme = await Programme.create({
      programmeCode: 'BTECH-CSE',
      programmeName: 'B.Tech in Computer Science and Engineering',
      degree: 'B.Tech',
      degreeLevel: 'Undergraduate',
      department: 'Computer Science and Engineering',
      duration: 4,
      durationUnit: 'years',
      seatCapacity: {
        total: 120,
        categoryAllocations: [
          { category: 'General', seats: 80 },
          { category: 'SC', seats: 20 },
          { category: 'ST', seats: 10 },
          { category: 'OBC', seats: 10 }
        ]
      },
      isActive: true
    });

    // Create Fee Structure
    feeStructure = await FeeStructure.create({
      programme: programme._id,
      academicSession: session._id,
      admissionFee: 25000,
      semesterFees: [{ semesterNumber: 1, amount: 65000 }],
      additionalFees: [{ feeName: 'Library & Lab Deposit', amount: 10000 }],
      totalProgrammeFee: 100000,
      currency: 'INR',
      isActive: true
    });

    // Create Eligible Application
    applicantApp = await Application.create({
      applicationId: 'IEM-2026-00001',
      applicant: applicantUser._id,
      academicSession: session.sessionName,
      selectedProgramme: programme._id,
      personalInfo: {
        fullName: applicantUser.fullName,
        dob: new Date('2004-05-20'),
        gender: 'Male',
        email: applicantUser.email,
        phone: '9830012345',
        address: 'Sector 5, Salt Lake',
        state: 'West Bengal',
        city: 'Kolkata',
        pincode: '700091'
      },
      academicInfo: {
        class10Board: 'CBSE',
        class10Percentage: 92,
        class12Board: 'CBSE',
        class12Percentage: 94,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: '1200',
        academicStream: 'Science (PCM)'
      },
      admissionInfo: {
        preferredDepartment: 'Computer Science & Engineering',
        admissionCategory: 'General'
      },
      documentVerificationStatus: 'Verified',
      status: 'Submitted'
    });

    // Create Uploaded Verified Documents for applicantApp
    await UploadedDocument.create({
      application: applicantApp._id,
      applicant: applicantUser._id,
      documentType: 'Class 10 Marksheet',
      originalFileName: 'class10.pdf',
      storedFileName: 'class10-123.pdf',
      filePath: '/uploads/documents/class10.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf',
      verificationStatus: 'Verified',
      verifiedBy: reviewerUser._id
    });

    await UploadedDocument.create({
      application: applicantApp._id,
      applicant: applicantUser._id,
      documentType: 'Class 12 Marksheet',
      originalFileName: 'class12.pdf',
      storedFileName: 'class12-123.pdf',
      filePath: '/uploads/documents/class12.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf',
      verificationStatus: 'Verified',
      verifiedBy: reviewerUser._id
    });

    // Create Waitlisted Application
    waitlistedApp = await Application.create({
      applicationId: 'IEM-2026-00002',
      applicant: waitlistedApplicantUser._id,
      academicSession: session.sessionName,
      selectedProgramme: programme._id,
      personalInfo: {
        fullName: waitlistedApplicantUser.fullName,
        dob: new Date('2004-08-11'),
        gender: 'Male',
        email: waitlistedApplicantUser.email,
        phone: '9830099999',
        address: 'New Town, Action Area 1',
        state: 'West Bengal',
        city: 'Kolkata',
        pincode: '700156'
      },
      academicInfo: {
        class10Board: 'ICSE',
        class10Percentage: 75,
        class12Board: 'ISC',
        class12Percentage: 78,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: '8500',
        academicStream: 'Science (PCM)'
      },
      admissionInfo: {
        preferredDepartment: 'Computer Science & Engineering',
        admissionCategory: 'General'
      },
      documentVerificationStatus: 'Verified',
      status: 'Submitted'
    });

    // Create Published Merit List
    const meritList = await MeritList.create({
      programme: programme._id,
      academicSession: session.sessionName,
      version: 1,
      status: 'Published',
      isPublished: true,
      generatedBy: adminUser._id,
      publishedBy: adminUser._id,
      entries: [
        {
          application: applicantApp._id,
          applicant: applicantUser._id,
          applicationId: applicantApp.applicationId,
          candidateName: applicantUser.fullName,
          category: 'General',
          class12Percentage: 94,
          rawEntranceScore: '1200',
          normalizedEntranceScore: 92,
          compositeScore: 93,
          meritRank: 1,
          categoryRank: 1,
          eligibilityStatus: 'Eligible'
        },
        {
          application: waitlistedApp._id,
          applicant: waitlistedApplicantUser._id,
          applicationId: waitlistedApp.applicationId,
          candidateName: waitlistedApplicantUser.fullName,
          category: 'General',
          class12Percentage: 78,
          rawEntranceScore: '8500',
          normalizedEntranceScore: 74,
          compositeScore: 76,
          meritRank: 2,
          categoryRank: 2,
          eligibilityStatus: 'Eligible'
        }
      ]
    });

    // Create Published Seat Allocation
    publishedAllocation = await SeatAllocation.create({
      programme: programme._id,
      academicSession: session.sessionName,
      meritList: meritList._id,
      allocationRound: 1,
      allocations: [
        {
          application: applicantApp._id,
          applicant: applicantUser._id,
          applicationId: applicantApp.applicationId || 'IEM-2026-00001',
          candidateName: applicantUser.fullName,
          meritRank: 1,
          appliedCategory: 'General',
          allocatedCategory: 'General',
          compositeScore: 93,
          seatNumber: 1,
          allocationStatus: 'Allocated'
        },
        {
          application: waitlistedApp._id,
          applicant: waitlistedApplicantUser._id,
          applicationId: waitlistedApp.applicationId || 'IEM-2026-00002',
          candidateName: waitlistedApplicantUser.fullName,
          meritRank: 2,
          appliedCategory: 'General',
          allocatedCategory: 'General',
          compositeScore: 76,
          seatNumber: null,
          allocationStatus: 'Waitlisted'
        }
      ],
      totalAllocated: 1,
      status: 'Published',
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: adminUser._id
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('1. Admission Confirmation Eligibility Engine', () => {
    it('should return eligible: true for candidate with published seat allocation and verified documents', async () => {
      const res = await request(app)
        .get('/api/payments/eligibility')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isEligible).toBe(true);
      expect(res.body.data.allocation).toBeDefined();
      expect(res.body.data.allocation.seatNumber).toBe(1);
      expect(res.body.data.allocation.allocatedCategory).toBe('General');
      expect(res.body.data.feeStructure).toBeDefined();
      expect(res.body.data.feeStructure.admissionFee).toBe(25000);
      expect(res.body.data.programme.programmeCode).toBe('BTECH-CSE');
    });

    it('should return eligible: false for waitlisted candidate', async () => {
      const res = await request(app)
        .get('/api/payments/eligibility')
        .set('Authorization', `Bearer ${waitlistedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isEligible).toBe(false);
      expect(res.body.data.reason).toMatch(/Waitlisted/i);
    });

    it('should return eligible: false if candidate has no seat allocation', async () => {
      const unallocatedUser = await User.create({
        fullName: 'Unallocated User',
        email: 'unallocated@iem.edu',
        password: 'Password123!',
        role: 'applicant',
        isEmailVerified: true
      });
      const unallocatedToken = generateTestToken(unallocatedUser);

      const res = await request(app)
        .get('/api/payments/eligibility')
        .set('Authorization', `Bearer ${unallocatedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isEligible).toBe(false);
      expect(res.body.data.reason).toMatch(/no admission application/i);
    });
  });

  describe('2. Payment Order Creation', () => {
    it('should reject payment order creation if applicant is not eligible', async () => {
      const res = await request(app)
        .post('/api/payments/order')
        .set('Authorization', `Bearer ${waitlistedToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Waitlisted/i);
    });

    it('should create payment order for eligible applicant and store fee snapshot', async () => {
      const res = await request(app)
        .post('/api/payments/order')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ idempotencyKey: 'idem-order-001' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toMatch(/^order_/);
      expect(res.body.data.amount).toBe(25000);
      expect(res.body.data.currency).toBe('INR');

      // Check payment record in DB
      const payment = await Payment.findOne({ orderId: res.body.data.orderId });
      expect(payment).toBeDefined();
      expect(payment.status).toBe('Initiated');
      expect(payment.feeSnapshot).toBeDefined();
      expect(payment.feeSnapshot.admissionFee).toBe(25000);
    });

    it('should be idempotent when passing existing pending/initiated order idempotency key', async () => {
      const res = await request(app)
        .post('/api/payments/order')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ idempotencyKey: 'idem-order-001' });

      expect(res.status).toBe(201);
      expect(res.body.data.orderId).toMatch(/^order_/);
    });
  });

  describe('3. Payment Verification & Permanent Enrolment', () => {
    it('should reject payment verification if signature does not match', async () => {
      const orderRes = await request(app)
        .post('/api/payments/order')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ idempotencyKey: 'idem-verify-bad-sig' });

      const activeOrder = orderRes.body.data;

      const res = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          orderId: activeOrder.orderId,
          paymentId: 'pay_test_invalid_123',
          signature: 'completely_invalid_signature'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/signature/i);
    });

    it('should successfully verify payment with valid signature and generate ENR-YYYY-XXXXX enrolment', async () => {
      const orderRes = await request(app)
        .post('/api/payments/order')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ idempotencyKey: 'idem-verify-good-sig' });

      const activeOrder = orderRes.body.data;
      const mockPaymentId = 'pay_test_valid_999';

      const validSignature = crypto
        .createHash('sha256')
        .update(`${activeOrder.orderId}|${mockPaymentId}`)
        .digest('hex');

      const res = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          orderId: activeOrder.orderId,
          paymentId: mockPaymentId,
          signature: validSignature
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enrolment).toBeDefined();
      expect(res.body.data.enrolment.enrolmentNumber).toMatch(/^ENR-\d{4}-\d{5}$/);
      expect(res.body.data.enrolment.allocatedCategory).toBe('General');
      expect(res.body.data.enrolment.seatNumber).toBe(1);
      expect(res.body.data.payment.status).toBe('Successful');

      // Verify Enrolment stored in DB
      const enrolment = await Enrolment.findOne({ enrolmentNumber: res.body.data.enrolment.enrolmentNumber });
      expect(enrolment).toBeDefined();
      expect(enrolment.applicant.toString()).toBe(applicantUser._id.toString());
      expect(enrolment.application.toString()).toBe(applicantApp._id.toString());

      // Verify Notification was generated
      const notification = await Notification.findOne({
        recipient: applicantUser._id,
        type: 'Admission_Confirmed'
      });
      expect(notification).toBeDefined();
      expect(notification.deliveryStatus).toBe('Sent');
    });

    it('should return existing enrolment idempotently on repeated verification', async () => {
      const payment = await Payment.findOne({ applicant: applicantUser._id, status: 'Successful' });
      expect(payment).toBeDefined();

      const res = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          orderId: payment.orderId,
          paymentId: payment.paymentId,
          signature: payment.signature
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enrolment).toBeDefined();
      expect(res.body.data.enrolment.enrolmentNumber).toMatch(/^ENR-\d{4}-\d{5}$/);
    });

    it('should reject new order creation if applicant is already confirmed and enrolled', async () => {
      const res = await request(app)
        .post('/api/payments/order')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already been confirmed/i);
    });
  });

  describe('4. Applicant Admission Receipt', () => {
    it('should retrieve confirmed admission receipt with all enrolment and payment details', async () => {
      const res = await request(app)
        .get('/api/payments/receipt')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasConfirmedAdmission).toBe(true);
      expect(res.body.data.enrolmentNumber).toMatch(/^ENR-\d{4}-\d{5}$/);
      expect(res.body.data.programme.programmeName).toBe(programme.programmeName);
      expect(res.body.data.paymentReference).toBeDefined();
      expect(res.body.data.feeAmountPaid).toBe(25000);
    });

    it('should return hasConfirmedAdmission: false for applicant without confirmed enrolment', async () => {
      const res = await request(app)
        .get('/api/payments/receipt')
        .set('Authorization', `Bearer ${waitlistedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasConfirmedAdmission).toBe(false);
    });
  });

  describe('5. Gateway Webhook Endpoint', () => {
    it('should process payment.failed webhook event', async () => {
      const testFailedOrder = await Payment.create({
        orderId: 'order_webhook_fail_123',
        applicant: waitlistedApplicantUser._id,
        application: waitlistedApp._id,
        programme: programme._id,
        academicSession: session.sessionName,
        feeStructure: feeStructure._id,
        amount: 25000,
        currency: 'INR',
        status: 'Initiated'
      });

      const payload = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail_001',
              order_id: testFailedOrder.orderId,
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment failed due to bank timeout'
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Payment.findById(testFailedOrder._id);
      expect(updated.status).toBe('Failed');
      expect(updated.failureReason).toMatch(/bank timeout/i);
    });
  });

  describe('6. Admin Payment Management, Reconciliation & Enrolment Directory', () => {
    it('should list all payment transactions with pagination and filters for admin', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payments.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('should retrieve payment details with audit history', async () => {
      const payment = await Payment.findOne({ status: 'Successful' });

      const res = await request(app)
        .get(`/api/payments/${payment._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(payment.orderId);
      expect(res.body.data.auditHistory.length).toBeGreaterThanOrEqual(1);
    });

    it('should reconcile a payment record with mandatory remarks', async () => {
      const pendingPayment = await Payment.create({
        orderId: 'order_reconcile_test',
        applicant: waitlistedApplicantUser._id,
        application: waitlistedApp._id,
        programme: programme._id,
        academicSession: session.sessionName,
        feeStructure: feeStructure._id,
        amount: 25000,
        currency: 'INR',
        status: 'Pending'
      });

      // Attempt reconciliation without remarks -> 400
      const failRes = await request(app)
        .post(`/api/payments/${pendingPayment._id}/reconcile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'Mark_Failed' });

      expect(failRes.status).toBe(400);
      expect(failRes.body.message).toMatch(/strictly required/i);

      // Reconcile with remarks -> 200
      const okRes = await request(app)
        .post(`/api/payments/${pendingPayment._id}/reconcile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'Mark_Failed', remarks: 'Transaction unconfirmed after 48h NEFT window' });

      expect(okRes.status).toBe(200);
      expect(okRes.body.success).toBe(true);
      expect(okRes.body.data.status).toBe('Failed');

      const reloaded = await Payment.findById(pendingPayment._id);
      expect(reloaded.status).toBe('Failed');
      expect(reloaded.auditHistory.some(a => a.action.includes('Reconciliation'))).toBe(true);
    });

    it('should list all confirmed enrolments for admin', async () => {
      const res = await request(app)
        .get('/api/payments/enrolments/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enrolments.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.enrolments[0].enrolmentNumber).toMatch(/^ENR-\d{4}-\d{5}$/);
    });

    it('should retrieve enrolment & fee collection statistics', async () => {
      const res = await request(app)
        .get('/api/payments/enrolments/statistics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalEnrolments).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalFeeCollected).toBeGreaterThanOrEqual(25000);
      expect(res.body.data.byProgramme).toBeDefined();
    });
  });

  describe('7. Role-Based Access Control (RBAC) Enforcement', () => {
    it('should reject Reviewer role on admin payment routes (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject Reviewer role on enrolment directory (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/payments/enrolments/all')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject Reviewer role on payment reconciliation (403 Forbidden)', async () => {
      const payment = await Payment.findOne();
      const res = await request(app)
        .post(`/api/payments/${payment._id}/reconcile`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ action: 'Mark_Failed', remarks: 'Unauthorized attempt' });

      expect(res.status).toBe(403);
    });

    it('should reject Applicant role on admin payment list (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request on payment endpoints (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/payments/eligibility');
      expect(res.status).toBe(401);
    });
  });
});
