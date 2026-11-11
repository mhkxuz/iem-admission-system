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
  FeeStructure,
  MeritList,
  SeatAllocation,
  Payment,
  Enrolment
} = require('../models');

let mongoServer;

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

describe('Upgrade Stage 5: Reporting, Analytics & Data Export Tests', () => {
  let adminUser, reviewerUser, applicantUser;
  let adminToken, reviewerToken, applicantToken;
  let session2026, session2025;
  let programmeCSE, programmeECE;
  let feeStructureCSE;
  let app1, app2, app3;
  let payment1, payment2Failed, payment3Pending;
  let enrolment1;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // 1. Users
    adminUser = await User.create({
      fullName: 'Dean of Admissions',
      email: 'dean.reports@iem.edu',
      password: 'Password123!',
      role: 'admin',
      isEmailVerified: true
    });
    adminToken = generateTestToken(adminUser);

    reviewerUser = await User.create({
      fullName: 'Document Officer',
      email: 'officer.reports@iem.edu',
      password: 'Password123!',
      role: 'reviewer',
      isEmailVerified: true
    });
    reviewerToken = generateTestToken(reviewerUser);

    applicantUser = await User.create({
      fullName: 'Aarav Patel',
      email: 'aarav.reports@iem.edu',
      password: 'Password123!',
      role: 'applicant',
      isEmailVerified: true
    });
    applicantToken = generateTestToken(applicantUser);

    // 2. Academic Sessions
    session2026 = await AcademicSession.create({
      sessionCode: '2026-2027',
      sessionName: '2026-2027',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isActive: true,
      isAdmissionOpen: true
    });

    session2025 = await AcademicSession.create({
      sessionCode: '2025-2026',
      sessionName: '2025-2026',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2026-05-31'),
      isActive: false,
      isAdmissionOpen: false
    });

    // 3. Programmes
    programmeCSE = await Programme.create({
      programmeCode: 'BTECH-CSE',
      programmeName: 'B.Tech in Computer Science and Engineering',
      degree: 'B.Tech',
      degreeLevel: 'Undergraduate',
      department: 'Computer Science and Engineering',
      duration: 4,
      durationUnit: 'years',
      seatCapacity: {
        total: 100,
        categoryAllocations: [
          { category: 'General', seats: 60 },
          { category: 'SC', seats: 20 },
          { category: 'ST', seats: 10 },
          { category: 'OBC', seats: 10 }
        ]
      },
      isActive: true
    });

    programmeECE = await Programme.create({
      programmeCode: 'BTECH-ECE',
      programmeName: 'B.Tech in Electronics and Communication Engineering',
      degree: 'B.Tech',
      degreeLevel: 'Undergraduate',
      department: 'Electronics and Communication Engineering',
      duration: 4,
      durationUnit: 'years',
      seatCapacity: {
        total: 60,
        categoryAllocations: [
          { category: 'General', seats: 40 },
          { category: 'SC', seats: 10 },
          { category: 'ST', seats: 5 },
          { category: 'OBC', seats: 5 }
        ]
      },
      isActive: true
    });

    // 4. Fee Structure
    feeStructureCSE = await FeeStructure.create({
      programme: programmeCSE._id,
      academicSession: session2026._id,
      admissionFee: 25000,
      semesterFees: [{ semesterNumber: 1, amount: 65000 }],
      additionalFees: [{ feeName: 'Lab & Library Deposit', amount: 10000 }],
      totalProgrammeFee: 100000,
      currency: 'INR',
      isActive: true
    });

    // 5. Applications
    app1 = await Application.create({
      applicationId: 'IEM-2026-00001',
      applicant: applicantUser._id,
      academicSession: session2026.sessionName,
      selectedProgramme: programmeCSE._id,
      personalInfo: {
        fullName: applicantUser.fullName,
        email: applicantUser.email,
        phone: '9830012345',
        dob: new Date('2004-01-15'),
        gender: 'Male',
        address: 'Salt Lake',
        state: 'West Bengal',
        city: 'Kolkata',
        pincode: '700091'
      },
      academicInfo: {
        class10Board: 'CBSE',
        class10Percentage: 92,
        class12Board: 'CBSE',
        class12Percentage: 95,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: '500',
        academicStream: 'Science (PCM)'
      },
      admissionInfo: {
        preferredDepartment: 'Computer Science & Engineering',
        admissionCategory: 'General'
      },
      documentVerificationStatus: 'Verified',
      status: 'Selected'
    });

    app2 = await Application.create({
      applicationId: 'IEM-2026-00002',
      applicant: new mongoose.Types.ObjectId(),
      academicSession: session2026.sessionName,
      selectedProgramme: programmeCSE._id,
      personalInfo: {
        fullName: 'Pooja Sharma',
        email: 'pooja@iem.edu',
        phone: '9830055555',
        dob: new Date('2004-03-20'),
        gender: 'Female',
        address: 'New Town',
        state: 'West Bengal',
        city: 'Kolkata',
        pincode: '700156'
      },
      academicInfo: {
        class10Board: 'ICSE',
        class10Percentage: 88,
        class12Board: 'ISC',
        class12Percentage: 86,
        class12PassingYear: 2024,
        entranceExamName: 'WBJEE',
        entranceExamScore: '2500',
        academicStream: 'Science (PCM)'
      },
      admissionInfo: {
        preferredDepartment: 'Computer Science & Engineering',
        admissionCategory: 'SC'
      },
      documentVerificationStatus: 'Pending',
      status: 'Submitted'
    });

    app3 = await Application.create({
      applicationId: 'IEM-2025-00001',
      applicant: new mongoose.Types.ObjectId(),
      academicSession: session2025.sessionName,
      selectedProgramme: programmeECE._id,
      personalInfo: {
        fullName: 'Vikram Singh',
        email: 'vikram@iem.edu',
        phone: '9830077777',
        dob: new Date('2003-11-10'),
        gender: 'Male',
        address: 'Howrah',
        state: 'West Bengal',
        city: 'Kolkata',
        pincode: '711101'
      },
      academicInfo: {
        class10Board: 'WBBSE',
        class10Percentage: 75,
        class12Board: 'WBCHSE',
        class12Percentage: 72,
        class12PassingYear: 2023,
        entranceExamName: 'WBJEE',
        entranceExamScore: '12000',
        academicStream: 'Science (PCM)'
      },
      admissionInfo: {
        preferredDepartment: 'Electronics & Communication Engineering',
        admissionCategory: 'OBC'
      },
      documentVerificationStatus: 'Rejected',
      status: 'Rejected'
    });

    // 6. Documents
    await UploadedDocument.create({
      application: app1._id,
      applicant: applicantUser._id,
      documentType: 'Class 10 Marksheet',
      originalFileName: 'class10.pdf',
      storedFileName: 'c10-1.pdf',
      filePath: '/uploads/documents/c10.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf',
      verificationStatus: 'Verified',
      verifiedBy: reviewerUser._id,
      verifiedAt: new Date()
    });

    await UploadedDocument.create({
      application: app1._id,
      applicant: applicantUser._id,
      documentType: 'Class 12 Marksheet',
      originalFileName: 'class12.pdf',
      storedFileName: 'c12-1.pdf',
      filePath: '/uploads/documents/c12.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf',
      verificationStatus: 'Verified',
      verifiedBy: reviewerUser._id,
      verifiedAt: new Date()
    });

    await UploadedDocument.create({
      application: app2._id,
      applicant: app2.applicant,
      documentType: 'Class 12 Marksheet',
      originalFileName: 'class12_pooja.pdf',
      storedFileName: 'c12-2.pdf',
      filePath: '/uploads/documents/c12-2.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf',
      verificationStatus: 'Pending'
    });

    await UploadedDocument.create({
      application: app3._id,
      applicant: app3.applicant,
      documentType: 'Class 12 Marksheet',
      originalFileName: 'class12_vikram.pdf',
      storedFileName: 'c12-3.pdf',
      filePath: '/uploads/documents/c12-3.pdf',
      fileSize: 102400,
      mimeType: 'application/pdf',
      verificationStatus: 'Rejected',
      verifiedBy: reviewerUser._id,
      verifiedAt: new Date()
    });

    // 7. Merit List & Allocation
    const meritList = await MeritList.create({
      programme: programmeCSE._id,
      academicSession: session2026.sessionName,
      version: 1,
      status: 'Published',
      isPublished: true,
      generatedBy: adminUser._id,
      publishedBy: adminUser._id,
      entries: [
        {
          application: app1._id,
          applicant: applicantUser._id,
          applicationId: app1.applicationId,
          candidateName: applicantUser.fullName,
          category: 'General',
          class12Percentage: 95,
          rawEntranceScore: '500',
          normalizedEntranceScore: 98,
          compositeScore: 96.2,
          meritRank: 1,
          categoryRank: 1,
          eligibilityStatus: 'Eligible'
        },
        {
          application: app2._id,
          applicant: app2.applicant,
          applicationId: app2.applicationId,
          candidateName: 'Pooja Sharma',
          category: 'SC',
          class12Percentage: 86,
          rawEntranceScore: '2500',
          normalizedEntranceScore: 84,
          compositeScore: 85.2,
          meritRank: 2,
          categoryRank: 1,
          eligibilityStatus: 'Eligible (Pending Documents)'
        }
      ],
      cutoffs: {
        highestScore: 96.2,
        lowestShortlistedScore: 85.2,
        totalEligible: 1,
        totalIneligible: 0,
        totalPendingDocs: 1,
        categoryCutoffs: [
          { category: 'General', highestScore: 96.2, lowestScore: 96.2, eligibleApplicants: 1 }
        ]
      }
    });

    await SeatAllocation.create({
      programme: programmeCSE._id,
      academicSession: session2026.sessionName,
      meritList: meritList._id,
      allocationRound: 1,
      allocations: [
        {
          application: app1._id,
          applicant: applicantUser._id,
          applicationId: app1.applicationId,
          candidateName: applicantUser.fullName,
          meritRank: 1,
          appliedCategory: 'General',
          allocatedCategory: 'General',
          compositeScore: 96.2,
          seatNumber: 1,
          allocationStatus: 'Allocated'
        },
        {
          application: app2._id,
          applicant: app2.applicant,
          applicationId: app2.applicationId,
          candidateName: 'Pooja Sharma',
          meritRank: 2,
          appliedCategory: 'SC',
          allocatedCategory: 'SC',
          compositeScore: 85.2,
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

    // 8. Payments (Successful vs Failed vs Pending)
    payment1 = await Payment.create({
      orderId: 'order_rep_001',
      paymentId: 'pay_rep_001',
      applicant: applicantUser._id,
      application: app1._id,
      programme: programmeCSE._id,
      academicSession: session2026.sessionName,
      feeStructure: feeStructureCSE._id,
      amount: 25000,
      currency: 'INR',
      status: 'Successful',
      gateway: 'sandbox',
      paidAt: new Date()
    });

    payment2Failed = await Payment.create({
      orderId: 'order_rep_fail_002',
      paymentId: 'pay_rep_fail_002',
      applicant: app2.applicant,
      application: app2._id,
      programme: programmeCSE._id,
      academicSession: session2026.sessionName,
      feeStructure: feeStructureCSE._id,
      amount: 25000,
      currency: 'INR',
      status: 'Failed',
      failureReason: 'Transaction expired'
    });

    payment3Pending = await Payment.create({
      orderId: 'order_rep_pend_003',
      applicant: app3.applicant,
      application: app3._id,
      programme: programmeECE._id,
      academicSession: session2025.sessionName,
      feeStructure: feeStructureCSE._id,
      amount: 25000,
      currency: 'INR',
      status: 'Pending'
    });

    // 9. Enrolment
    enrolment1 = await Enrolment.create({
      enrolmentNumber: 'ENR-2026-00001',
      applicant: applicantUser._id,
      application: app1._id,
      applicationId: app1.applicationId,
      programme: programmeCSE._id,
      academicSession: session2026.sessionName,
      allocatedCategory: 'General',
      seatNumber: 1,
      payment: payment1._id,
      paymentReference: payment1.paymentId,
      feeAmountPaid: 25000,
      currency: 'INR',
      enrolmentStatus: 'Confirmed',
      confirmedAt: new Date()
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('1. Centralized Overview Analytics', () => {
    it('should aggregate overall KPIs accurately across applications, documents, enrolments, and revenue', async () => {
      const res = await request(app)
        .get('/api/admin/reports/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.kpis.totalApplications).toBe(3);
      expect(res.body.data.kpis.totalEnrolled).toBe(1);
      // Financial rule: Only successful payment is counted (25,000), excluding Failed and Pending
      expect(res.body.data.kpis.totalFeesCollected).toBe(25000);
      expect(res.body.data.kpis.verifiedDocuments).toBe(2);
      expect(res.body.data.kpis.pendingDocuments).toBe(1);
      expect(res.body.data.kpis.rejectedDocuments).toBe(1);
    });

    it('should filter overview analytics by academic session', async () => {
      const res = await request(app)
        .get('/api/admin/reports/overview?academicSession=2026-2027')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.kpis.totalApplications).toBe(2);
      expect(res.body.data.kpis.totalEnrolled).toBe(1);
      expect(res.body.data.kpis.totalFeesCollected).toBe(25000);
    });
  });

  describe('2. Application Analytics & Distributions', () => {
    it('should provide application breakdown by status, programme, session, and category', async () => {
      const res = await request(app)
        .get('/api/admin/reports/applications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalApplications).toBe(3);

      // By Programme
      const cseProg = res.body.data.byProgramme.find((p) => p.programmeCode === 'BTECH-CSE');
      expect(cseProg).toBeDefined();
      expect(cseProg.count).toBe(2);

      // By Category
      const genCat = res.body.data.byCategory.find((c) => c.category === 'General');
      expect(genCat.count).toBe(1);

      // By Session
      expect(res.body.data.bySession.length).toBe(2);
    });

    it('should filter applications by programmeId and category', async () => {
      const res = await request(app)
        .get(`/api/admin/reports/applications?programmeId=${programmeCSE._id}&category=SC`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalApplications).toBe(1);
      expect(res.body.data.byCategory[0].category).toBe('SC');
    });
  });

  describe('3. Document Verification Analytics', () => {
    it('should compute document counts, document-type distribution, and reviewer workloads', async () => {
      const res = await request(app)
        .get('/api/admin/reports/documents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalDocuments).toBe(4);
      expect(res.body.data.verifiedCount).toBe(2);
      expect(res.body.data.pendingCount).toBe(1);
      expect(res.body.data.rejectedCount).toBe(1);

      // Reviewer Workload
      expect(res.body.data.byReviewer.length).toBeGreaterThanOrEqual(1);
      const reviewerStats = res.body.data.byReviewer.find(
        (r) => r.reviewerEmail === reviewerUser.email
      );
      expect(reviewerStats).toBeDefined();
      expect(reviewerStats.verified).toBe(2);
      expect(reviewerStats.rejected).toBe(1);
      expect(reviewerStats.totalProcessed).toBe(3);
    });
  });

  describe('4. Merit List & Seat Allocation Analytics', () => {
    it('should report merit summaries, cutoffs, seat capacities, and utilization rates', async () => {
      const res = await request(app)
        .get('/api/admin/reports/merit?academicSession=2026-2027')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totals.totalCapacity).toBe(100);
      expect(res.body.data.totals.totalAllocatedSeats).toBe(1);
      expect(res.body.data.totals.totalWaitlistedSeats).toBe(1);
      expect(res.body.data.totals.totalVacantSeats).toBe(99);
      expect(res.body.data.totals.overallSeatUtilizationPercentage).toBe(1);

      // Cutoff summary from published merit list
      const summary = res.body.data.programmeMeritSummaries[0];
      expect(summary.cutoffs.highestScore).toBe(96.2);
    });
  });

  describe('5. Payment & Enrolment Financial Analytics', () => {
    it('should accurately calculate verified collected revenue without counting pending or failed payments', async () => {
      const res = await request(app)
        .get('/api/admin/reports/payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.kpis.totalEnrolled).toBe(1);
      // Only payment1 (25000) was successful; payment2 (25000 failed) and payment3 (25000 pending) MUST be excluded from revenue!
      expect(res.body.data.kpis.verifiedRevenueCollected).toBe(25000);
      expect(res.body.data.kpis.successfulPayments).toBe(1);
      expect(res.body.data.kpis.failedPayments).toBe(1);
      expect(res.body.data.kpis.pendingPayments).toBe(1);

      // Programme collections
      expect(res.body.data.programmeCollections.length).toBe(1);
      expect(res.body.data.programmeCollections[0].feeCollected).toBe(25000);
      expect(res.body.data.programmeCollections[0].enrolledCount).toBe(1);
    });
  });

  describe('6. CSV Export Functionality & Formula Injection Protection', () => {
    it('should export applications report as CSV with sanitized formula cells', async () => {
      // Create malicious candidate testing formula injection
      await Application.create({
        applicationId: 'IEM-2026-INJECT',
        applicant: new mongoose.Types.ObjectId(),
        academicSession: session2026.sessionName,
        selectedProgramme: programmeCSE._id,
        personalInfo: {
          fullName: '=1+1', // Attempted CSV formula injection
          email: '+inject@iem.edu',
          phone: '-1234567890',
          dob: new Date('2004-01-01'),
          gender: 'Other',
          address: 'Test Injection Street',
          city: 'Kolkata',
          state: 'West Bengal',
          pincode: '700091'
        },
        academicInfo: {
          class10Board: 'CBSE',
          class10Percentage: 80,
          class12Board: 'CBSE',
          class12Percentage: 80,
          class12PassingYear: 2024,
          entranceExamName: 'WBJEE',
          entranceExamScore: '@cmd'
        },
        admissionInfo: {
          preferredDepartment: 'Computer Science & Engineering',
          admissionCategory: 'General'
        },
        status: 'Submitted'
      });

      const res = await request(app)
        .get('/api/admin/reports/export/applications?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="iem-applications-report-.*\.csv"/);

      const csvText = res.text;
      // Formula Injection Sanitization: cells starting with '=', '+', '-', '@' must be escaped with a single quote "'"
      expect(csvText).toContain("Application ID,Candidate Name");
      expect(csvText).toContain("'=1+1");
      expect(csvText).toContain("'+inject@iem.edu");
    });

    it('should export enrolments report as CSV', async () => {
      const res = await request(app)
        .get('/api/admin/reports/export/enrolments?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('ENR-2026-00001');
      expect(res.text).toContain('25000');
    });

    it('should export fee collection summary as CSV', async () => {
      const res = await request(app)
        .get('/api/admin/reports/export/fee-summary?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('BTECH-CSE');
    });
  });

  describe('7. PDF Generation Functionality', () => {
    it('should generate valid PDF report with correct headers and binary output', async () => {
      const res = await request(app)
        .get('/api/admin/reports/export/applications?format=pdf')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="iem-applications-report-.*\.pdf"/);

      // Verify PDF Magic Bytes: %PDF-1.4
      const pdfHeader = res.body.slice(0, 8).toString('utf-8');
      expect(pdfHeader).toContain('%PDF-1.4');
    });

    it('should generate PDF for confirmed enrolments', async () => {
      const res = await request(app)
        .get('/api/admin/reports/export/enrolments?format=pdf')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      const pdfHeader = res.body.slice(0, 8).toString('utf-8');
      expect(pdfHeader).toContain('%PDF-1.4');
    });
  });

  describe('8. Role-Based Access Control (RBAC) Enforcement', () => {
    it('should reject Reviewer role on overview reporting (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/admin/reports/overview')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject Reviewer role on export endpoints (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/admin/reports/export/enrolments?format=csv')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject Applicant role on reporting endpoints (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/admin/reports/overview')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests on reporting endpoints (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/admin/reports/overview');
      expect(res.status).toBe(401);
    });
  });
});
