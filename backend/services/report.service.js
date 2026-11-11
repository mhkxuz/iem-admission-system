const mongoose = require('mongoose');
const {
  Application,
  UploadedDocument,
  DocumentVerificationHistory,
  MeritList,
  SeatAllocation,
  Programme,
  AcademicSession,
  FeeStructure,
  Payment,
  Enrolment,
  User
} = require('../models');
const { generateCsv, generatePdf } = require('../utils/report-export.util');
const AppError = require('../utils/app-error');

/**
 * Build MongoDB query for Applications matching common report filters
 */
function buildApplicationFilter(filters = {}) {
  const query = {};

  if (filters.academicSession) {
    query.academicSession = filters.academicSession;
  }

  if (filters.programmeId) {
    if (mongoose.Types.ObjectId.isValid(filters.programmeId)) {
      query.selectedProgramme = new mongoose.Types.ObjectId(filters.programmeId);
    }
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.category) {
    query['admissionInfo.admissionCategory'] = filters.category;
  }

  if (filters.documentStatus) {
    query.documentVerificationStatus = filters.documentStatus;
  }

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  return query;
}

/**
 * 1. Overview Analytics: High-level KPI metrics & aggregated trends
 */
async function getOverviewAnalytics(filters = {}) {
  const appQuery = buildApplicationFilter(filters);

  // A. Total applications & status breakdown
  const [statusAgg, totalApps] = await Promise.all([
    Application.aggregate([
      { $match: appQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Application.countDocuments(appQuery)
  ]);

  const appStatusCounts = {
    Submitted: 0,
    'Under Review': 0,
    Selected: 0,
    Rejected: 0
  };
  statusAgg.forEach((item) => {
    if (item._id && appStatusCounts.hasOwnProperty(item._id)) {
      appStatusCounts[item._id] = item.count;
    }
  });

  // B. Document verification counts
  const docMatch = {};
  if (filters.startDate || filters.endDate) {
    docMatch.createdAt = {};
    if (filters.startDate) docMatch.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      docMatch.createdAt.$lte = end;
    }
  }
  const [docTotal, docVerified, docPending, docRejected] = await Promise.all([
    UploadedDocument.countDocuments(docMatch),
    UploadedDocument.countDocuments({ ...docMatch, verificationStatus: 'Verified' }),
    UploadedDocument.countDocuments({ ...docMatch, verificationStatus: 'Pending' }),
    UploadedDocument.countDocuments({ ...docMatch, verificationStatus: 'Rejected' })
  ]);

  // C. Confirmed Enrolments & Verified Collected Revenue
  const paymentMatch = { status: 'Successful' };
  const enrolmentMatch = {};
  if (filters.academicSession) {
    paymentMatch.academicSession = filters.academicSession;
    enrolmentMatch.academicSession = filters.academicSession;
  }
  if (filters.programmeId && mongoose.Types.ObjectId.isValid(filters.programmeId)) {
    paymentMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
    enrolmentMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
  }

  const [totalEnrolled, revenueAgg] = await Promise.all([
    Enrolment.countDocuments(enrolmentMatch),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ])
  ]);
  const totalFeesCollected = revenueAgg[0]?.totalRevenue || 0;

  // D. Monthly application submission trend
  const submissionTrend = await Application.aggregate([
    { $match: appQuery },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { month: '$_id', count: 1, _id: 0 } }
  ]);

  return {
    kpis: {
      totalApplications: totalApps,
      totalEnrolled,
      totalFeesCollected,
      submittedApplications: appStatusCounts.Submitted,
      underReviewApplications: appStatusCounts['Under Review'],
      selectedApplications: appStatusCounts.Selected,
      rejectedApplications: appStatusCounts.Rejected,
      totalDocuments: docTotal,
      verifiedDocuments: docVerified,
      pendingDocuments: docPending,
      rejectedDocuments: docRejected
    },
    statusDistribution: Object.entries(appStatusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: totalApps > 0 ? Number(((count / totalApps) * 100).toFixed(1)) : 0
    })),
    submissionTrend
  };
}

/**
 * 2. Application Analytics: Detailed breakdown by programme, session, category, and trends
 */
async function getApplicationAnalytics(filters = {}) {
  const appQuery = buildApplicationFilter(filters);
  const totalApps = await Application.countDocuments(appQuery);

  // A. Programme Distribution
  const programmeAgg = await Application.aggregate([
    { $match: appQuery },
    {
      $group: {
        _id: '$selectedProgramme',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'programmes',
        localField: '_id',
        foreignField: '_id',
        as: 'progInfo'
      }
    },
    {
      $project: {
        programmeId: '$_id',
        programmeName: { $ifNull: [{ $arrayElemAt: ['$progInfo.programmeName', 0] }, 'Unassigned'] },
        programmeCode: { $ifNull: [{ $arrayElemAt: ['$progInfo.programmeCode', 0] }, 'N/A'] },
        count: 1
      }
    },
    { $sort: { count: -1 } }
  ]);

  const byProgramme = programmeAgg.map((item) => ({
    programmeId: item.programmeId,
    programmeName: item.programmeName,
    programmeCode: item.programmeCode,
    count: item.count,
    percentage: totalApps > 0 ? Number(((item.count / totalApps) * 100).toFixed(1)) : 0
  }));

  // B. Academic Session Distribution
  const bySession = await Application.aggregate([
    { $match: appQuery },
    { $group: { _id: '$academicSession', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
    { $project: { session: '$_id', count: 1, _id: 0 } }
  ]);

  // C. Category Distribution
  const categoryAgg = await Application.aggregate([
    { $match: appQuery },
    { $group: { _id: '$admissionInfo.admissionCategory', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const byCategory = categoryAgg.map((item) => ({
    category: item._id || 'General',
    count: item.count,
    percentage: totalApps > 0 ? Number(((item.count / totalApps) * 100).toFixed(1)) : 0
  }));

  // D. Status Distribution
  const statusAgg = await Application.aggregate([
    { $match: appQuery },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const byStatus = statusAgg.map((item) => ({
    status: item._id,
    count: item.count,
    percentage: totalApps > 0 ? Number(((item.count / totalApps) * 100).toFixed(1)) : 0
  }));

  // E. Processing Completion Rate
  const selectedCount = byStatus.find((s) => s.status === 'Selected')?.count || 0;
  const rejectedCount = byStatus.find((s) => s.status === 'Rejected')?.count || 0;
  const processedCount = selectedCount + rejectedCount;
  const completionRate = totalApps > 0 ? Number(((processedCount / totalApps) * 100).toFixed(1)) : 0;

  // F. Timeline trend (daily or monthly)
  const timelineTrend = await Application.aggregate([
    { $match: appQuery },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', count: 1, _id: 0 } }
  ]);

  return {
    totalApplications: totalApps,
    completionRate,
    byProgramme,
    bySession,
    byCategory,
    byStatus,
    timelineTrend
  };
}

/**
 * 3. Document Verification Analytics: Workloads, status breakdown, reviewer activity
 */
async function getDocumentAnalytics(filters = {}) {
  const docMatch = {};
  if (filters.documentStatus) {
    docMatch.verificationStatus = filters.documentStatus;
  }
  if (filters.startDate || filters.endDate) {
    docMatch.createdAt = {};
    if (filters.startDate) docMatch.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      docMatch.createdAt.$lte = end;
    }
  }

  const [totalDocs, verifiedCount, pendingCount, rejectedCount] = await Promise.all([
    UploadedDocument.countDocuments(docMatch),
    UploadedDocument.countDocuments({ ...docMatch, verificationStatus: 'Verified' }),
    UploadedDocument.countDocuments({ ...docMatch, verificationStatus: 'Pending' }),
    UploadedDocument.countDocuments({ ...docMatch, verificationStatus: 'Rejected' })
  ]);

  // Distribution by document type
  const byTypeAgg = await UploadedDocument.aggregate([
    { $match: docMatch },
    {
      $group: {
        _id: '$documentType',
        total: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'Verified'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'Pending'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'Rejected'] }, 1, 0] } }
      }
    },
    { $sort: { total: -1 } }
  ]);

  const byDocumentType = byTypeAgg.map((item) => ({
    documentType: item._id,
    total: item.total,
    verified: item.verified,
    pending: item.pending,
    rejected: item.rejected
  }));

  // Reviewer Workload Breakdown
  const reviewerAgg = await UploadedDocument.aggregate([
    {
      $match: {
        ...docMatch,
        verifiedBy: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$verifiedBy',
        verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'Verified'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'Rejected'] }, 1, 0] } },
        totalProcessed: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'reviewer'
      }
    },
    {
      $project: {
        reviewerId: '$_id',
        reviewerName: { $ifNull: [{ $arrayElemAt: ['$reviewer.fullName', 0] }, 'Reviewer'] },
        reviewerEmail: { $ifNull: [{ $arrayElemAt: ['$reviewer.email', 0] }, 'N/A'] },
        verified: 1,
        rejected: 1,
        totalProcessed: 1
      }
    },
    { $sort: { totalProcessed: -1 } }
  ]);

  // Applications with outstanding document requirements
  const outstandingAppsCount = await Application.countDocuments({
    documentVerificationStatus: { $in: ['Pending', 'Rejected'] }
  });

  return {
    totalDocuments: totalDocs,
    verifiedCount,
    pendingCount,
    rejectedCount,
    outstandingApplicationsCount: outstandingAppsCount,
    byDocumentType,
    byReviewer: reviewerAgg
  };
}

/**
 * 4. Merit List & Seat Allocation Analytics: Cutoffs, capacity, utilization
 */
async function getMeritAnalytics(filters = {}) {
  const meritMatch = {};
  const allocMatch = {};

  if (filters.academicSession) {
    meritMatch.academicSession = filters.academicSession;
    allocMatch.academicSession = filters.academicSession;
  }
  if (filters.programmeId && mongoose.Types.ObjectId.isValid(filters.programmeId)) {
    meritMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
    allocMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
  }

  // A. Published Merit Lists
  const meritLists = await MeritList.find(meritMatch)
    .populate('programme', 'programmeName programmeCode seatCapacity')
    .sort({ publishedAt: -1, createdAt: -1 });

  let totalScreenedCandidates = 0;
  let totalEligibleCandidates = 0;
  let totalIneligibleCandidates = 0;
  let totalPendingDocCandidates = 0;

  const programmeMeritSummaries = meritLists.map((ml) => {
    const entries = ml.entries || [];
    const eligible = entries.filter((e) => e.eligibilityStatus === 'Eligible').length;
    const ineligible = entries.filter((e) => e.eligibilityStatus === 'Ineligible').length;
    const pendingDocs = entries.filter((e) => e.eligibilityStatus === 'Eligible (Pending Documents)').length;

    totalScreenedCandidates += entries.length;
    totalEligibleCandidates += eligible;
    totalIneligibleCandidates += ineligible;
    totalPendingDocCandidates += pendingDocs;

    return {
      meritListId: ml._id,
      programmeName: ml.programme?.programmeName,
      programmeCode: ml.programme?.programmeCode,
      academicSession: ml.academicSession,
      status: ml.status,
      isPublished: ml.isPublished,
      totalEntries: entries.length,
      eligibleCount: eligible,
      ineligibleCount: ineligible,
      pendingDocsCount: pendingDocs,
      cutoffs: ml.cutoffs || null,
      publishedAt: ml.publishedAt
    };
  });

  // B. Seat Allocations & Utilization
  const allocations = await SeatAllocation.find(allocMatch)
    .populate('programme', 'programmeName programmeCode seatCapacity')
    .sort({ publishedAt: -1, createdAt: -1 });

  let totalAllocatedSeats = 0;
  let totalWaitlistedSeats = 0;
  let totalCapacityAllProgrammes = 0;

  const allocationSummaries = allocations.map((sa) => {
    const allocs = sa.allocations || [];
    const allocated = allocs.filter((a) => a.allocationStatus === 'Allocated').length;
    const waitlisted = allocs.filter((a) => a.allocationStatus === 'Waitlisted').length;
    const totalCapacity = sa.programme?.seatCapacity?.total || 0;
    const vacant = Math.max(0, totalCapacity - allocated);
    const utilization = totalCapacity > 0 ? Number(((allocated / totalCapacity) * 100).toFixed(1)) : 0;

    totalAllocatedSeats += allocated;
    totalWaitlistedSeats += waitlisted;
    totalCapacityAllProgrammes += totalCapacity;

    // Category breakdown
    const categoryBreakdown = {};
    allocs.forEach((a) => {
      const cat = a.allocatedCategory || 'Unassigned';
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = 0;
      if (a.allocationStatus === 'Allocated') categoryBreakdown[cat]++;
    });

    return {
      allocationId: sa._id,
      programmeName: sa.programme?.programmeName,
      programmeCode: sa.programme?.programmeCode,
      academicSession: sa.academicSession,
      allocationRound: sa.allocationRound,
      status: sa.status,
      isPublished: sa.isPublished,
      totalCapacity,
      allocatedSeats: allocated,
      waitlistedSeats: waitlisted,
      vacantSeats: vacant,
      seatUtilizationPercentage: utilization,
      categoryAllocations: Object.entries(categoryBreakdown).map(([category, count]) => ({
        category,
        count
      }))
    };
  });

  const overallUtilization =
    totalCapacityAllProgrammes > 0
      ? Number(((totalAllocatedSeats / totalCapacityAllProgrammes) * 100).toFixed(1))
      : 0;

  return {
    totals: {
      totalScreenedCandidates,
      totalEligibleCandidates,
      totalIneligibleCandidates,
      totalPendingDocCandidates,
      totalCapacity: totalCapacityAllProgrammes,
      totalAllocatedSeats,
      totalWaitlistedSeats,
      totalVacantSeats: Math.max(0, totalCapacityAllProgrammes - totalAllocatedSeats),
      overallSeatUtilizationPercentage: overallUtilization
    },
    programmeMeritSummaries,
    allocationSummaries
  };
}

/**
 * 5. Payment and Enrolment Analytics: Verified revenue, transaction health, programme collections
 */
async function getPaymentAnalytics(filters = {}) {
  const paymentMatch = {};
  const enrolmentMatch = {};

  if (filters.academicSession) {
    paymentMatch.academicSession = filters.academicSession;
    enrolmentMatch.academicSession = filters.academicSession;
  }
  if (filters.programmeId && mongoose.Types.ObjectId.isValid(filters.programmeId)) {
    paymentMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
    enrolmentMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
  }
  if (filters.paymentStatus) {
    paymentMatch.status = filters.paymentStatus;
  }
  if (filters.startDate || filters.endDate) {
    paymentMatch.createdAt = {};
    if (filters.startDate) paymentMatch.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      paymentMatch.createdAt.$lte = end;
    }
  }

  // Financial Rules Enforcement:
  // Count ONLY status: 'Successful' as verified collected revenue!
  const [totalEnrolled, revenueAgg, statusBreakdownAgg] = await Promise.all([
    Enrolment.countDocuments(enrolmentMatch),
    Payment.aggregate([
      { $match: { ...paymentMatch, status: 'Successful' } },
      { $group: { _id: null, totalCollected: { $sum: '$amount' } } }
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ])
  ]);

  const verifiedRevenueCollected = revenueAgg[0]?.totalCollected || 0;

  const paymentHealth = {
    Successful: { count: 0, amount: 0 },
    Initiated: { count: 0, amount: 0 },
    Pending: { count: 0, amount: 0 },
    Failed: { count: 0, amount: 0 },
    Cancelled: { count: 0, amount: 0 }
  };

  statusBreakdownAgg.forEach((item) => {
    if (item._id && paymentHealth.hasOwnProperty(item._id)) {
      paymentHealth[item._id] = { count: item.count, amount: item.totalAmount };
    }
  });

  // Programme-wise Revenue & Enrolment
  const programmeCollections = await Enrolment.aggregate([
    { $match: enrolmentMatch },
    {
      $group: {
        _id: '$programme',
        enrolledCount: { $sum: 1 },
        feeCollected: { $sum: '$feeAmountPaid' }
      }
    },
    {
      $lookup: {
        from: 'programmes',
        localField: '_id',
        foreignField: '_id',
        as: 'prog'
      }
    },
    {
      $project: {
        programmeId: '$_id',
        programmeName: { $ifNull: [{ $arrayElemAt: ['$prog.programmeName', 0] }, 'Unknown'] },
        programmeCode: { $ifNull: [{ $arrayElemAt: ['$prog.programmeCode', 0] }, 'N/A'] },
        enrolledCount: 1,
        feeCollected: 1
      }
    },
    { $sort: { feeCollected: -1 } }
  ]);

  // Category-wise Enrolment Distribution
  const categoryEnrolments = await Enrolment.aggregate([
    { $match: enrolmentMatch },
    { $group: { _id: '$allocatedCategory', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { category: '$_id', count: 1, _id: 0 } }
  ]);

  // Revenue Collection Trend (by day)
  const revenueTrend = await Payment.aggregate([
    { $match: { ...paymentMatch, status: 'Successful' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
        revenue: { $sum: '$amount' },
        transactions: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', revenue: 1, transactions: 1, _id: 0 } }
  ]);

  // Reconciliation summaries: payments with manual reconciliation audit entries
  const reconciledPaymentsCount = await Payment.countDocuments({
    'auditHistory.source': 'AdminReconciliation'
  });

  return {
    kpis: {
      totalEnrolled,
      verifiedRevenueCollected,
      successfulPayments: paymentHealth.Successful.count,
      pendingPayments: paymentHealth.Initiated.count + paymentHealth.Pending.count,
      failedPayments: paymentHealth.Failed.count,
      cancelledPayments: paymentHealth.Cancelled.count,
      reconciledPaymentsCount
    },
    paymentHealth,
    programmeCollections,
    categoryEnrolments,
    revenueTrend
  };
}

/**
 * 6. Export Reports (CSV and PDF)
 */
async function exportReport({ type, format = 'csv', filters = {} }) {
  const safeFormat = (format || 'csv').toLowerCase();
  if (safeFormat !== 'csv' && safeFormat !== 'pdf') {
    throw new AppError("Invalid export format. Supported formats: 'csv', 'pdf'", 400);
  }

  let title = 'Admission Report';
  let headers = [];
  let rows = [];
  let kpis = [];

  switch (type) {
    case 'applications': {
      title = 'Applications Directory Report';
      const appQuery = buildApplicationFilter(filters);
      const applications = await Application.find(appQuery)
        .populate('applicant', 'fullName email phone')
        .populate('selectedProgramme', 'programmeName programmeCode')
        .sort({ createdAt: -1 });

      headers = [
        'Application ID',
        'Candidate Name',
        'Email',
        'Phone',
        'Programme Code',
        'Programme Name',
        'Session',
        'Category',
        'Class 12 %',
        'Entrance Exam',
        'Score',
        'Doc Status',
        'Status',
        'Created At'
      ];

      rows = applications.map((app) => [
        app.applicationId,
        app.personalInfo?.fullName || app.applicant?.fullName || 'N/A',
        app.personalInfo?.email || app.applicant?.email || 'N/A',
        app.personalInfo?.phone || app.applicant?.phone || 'N/A',
        app.selectedProgramme?.programmeCode || 'N/A',
        app.selectedProgramme?.programmeName || 'N/A',
        app.academicSession,
        app.admissionInfo?.admissionCategory || 'General',
        app.academicInfo?.class12Percentage ?? 'N/A',
        app.academicInfo?.entranceExamName || 'N/A',
        app.academicInfo?.entranceExamScore || 'N/A',
        app.documentVerificationStatus || 'Pending',
        app.status,
        app.createdAt ? new Date(app.createdAt).toISOString().substring(0, 10) : 'N/A'
      ]);

      kpis = [{ label: 'Total Records', value: applications.length }];
      break;
    }

    case 'applicants': {
      title = 'Applicant Directory Report';
      const applicants = await User.find({ role: 'applicant' }).sort({ createdAt: -1 });
      const applicantIds = applicants.map((a) => a._id);

      const [apps, enrolments] = await Promise.all([
        Application.find({ applicant: { $in: applicantIds } }).select('applicant applicationId status'),
        Enrolment.find({ applicant: { $in: applicantIds } }).select('applicant enrolmentNumber confirmedAt')
      ]);

      const appMap = {};
      apps.forEach((a) => {
        appMap[a.applicant.toString()] = a;
      });
      const enrolMap = {};
      enrolments.forEach((e) => {
        enrolMap[e.applicant.toString()] = e;
      });

      headers = [
        'Candidate Name',
        'Email',
        'Phone',
        'Application ID',
        'Application Status',
        'Enrolment Number',
        'Enrolment Status',
        'Registered Date'
      ];

      rows = applicants.map((u) => {
        const userApp = appMap[u._id.toString()];
        const userEnrol = enrolMap[u._id.toString()];
        return [
          u.fullName,
          u.email,
          u.phone || 'N/A',
          userApp?.applicationId || 'Not Applied',
          userApp?.status || 'N/A',
          userEnrol?.enrolmentNumber || 'Not Enrolled',
          userEnrol ? 'Confirmed' : 'Unconfirmed',
          u.createdAt ? new Date(u.createdAt).toISOString().substring(0, 10) : 'N/A'
        ];
      });

      kpis = [
        { label: 'Total Applicants', value: applicants.length },
        { label: 'Enrolled Count', value: enrolments.length }
      ];
      break;
    }

    case 'documents': {
      title = 'Document Verification Audit Report';
      const docMatch = {};
      if (filters.documentStatus) docMatch.verificationStatus = filters.documentStatus;

      const docs = await UploadedDocument.find(docMatch)
        .populate('applicant', 'fullName email')
        .populate('application', 'applicationId')
        .populate('verifiedBy', 'fullName email')
        .sort({ uploadedAt: -1 });

      headers = [
        'Application ID',
        'Candidate Name',
        'Document Type',
        'Original File',
        'File Size (Bytes)',
        'Verification Status',
        'Verified By',
        'Verified At'
      ];

      rows = docs.map((d) => [
        d.application?.applicationId || 'N/A',
        d.applicant?.fullName || 'N/A',
        d.documentType,
        d.originalFileName,
        d.fileSize || 0,
        d.verificationStatus,
        d.verifiedBy?.fullName || 'Unassigned',
        d.verifiedAt ? new Date(d.verifiedAt).toISOString().substring(0, 10) : 'Pending'
      ]);

      kpis = [
        { label: 'Total Docs', value: docs.length },
        { label: 'Verified', value: docs.filter((d) => d.verificationStatus === 'Verified').length },
        { label: 'Pending', value: docs.filter((d) => d.verificationStatus === 'Pending').length },
        { label: 'Rejected', value: docs.filter((d) => d.verificationStatus === 'Rejected').length }
      ];
      break;
    }

    case 'merit': {
      title = 'Merit List Report';
      const meritMatch = {};
      if (filters.academicSession) meritMatch.academicSession = filters.academicSession;
      if (filters.programmeId && mongoose.Types.ObjectId.isValid(filters.programmeId)) {
        meritMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
      }

      const meritLists = await MeritList.find(meritMatch)
        .populate('programme', 'programmeName programmeCode')
        .sort({ createdAt: -1 });

      headers = [
        'Merit Rank',
        'Category Rank',
        'Candidate Name',
        'Application ID',
        'Programme',
        'Category',
        'Class 12 %',
        'Entrance Score',
        'Composite Score',
        'Eligibility Status'
      ];

      rows = [];
      meritLists.forEach((ml) => {
        const progCode = ml.programme?.programmeCode || '';
        (ml.entries || []).forEach((e) => {
          rows.push([
            e.meritRank ?? 'N/A',
            e.categoryRank ?? 'N/A',
            e.candidateName,
            e.applicationId,
            progCode,
            e.category,
            e.class12Percentage ?? 'N/A',
            e.rawEntranceScore || 'N/A',
            e.compositeScore != null ? Number(e.compositeScore).toFixed(2) : 'N/A',
            e.eligibilityStatus
          ]);
        });
      });

      kpis = [
        { label: 'Total Entries', value: rows.length },
        { label: 'Lists Generated', value: meritLists.length }
      ];
      break;
    }

    case 'allocations': {
      title = 'Seat Allocation Report';
      const allocMatch = {};
      if (filters.academicSession) allocMatch.academicSession = filters.academicSession;
      if (filters.programmeId && mongoose.Types.ObjectId.isValid(filters.programmeId)) {
        allocMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
      }

      const seatAllocations = await SeatAllocation.find(allocMatch)
        .populate('programme', 'programmeName programmeCode')
        .sort({ createdAt: -1 });

      headers = [
        'Round',
        'Programme',
        'Candidate Name',
        'Application ID',
        'Merit Rank',
        'Allocated Category',
        'Seat Number',
        'Allocation Status'
      ];

      rows = [];
      seatAllocations.forEach((sa) => {
        const progCode = sa.programme?.programmeCode || '';
        (sa.allocations || []).forEach((a) => {
          rows.push([
            sa.allocationRound,
            progCode,
            a.candidateName,
            a.applicationId,
            a.meritRank ?? 'N/A',
            a.allocatedCategory,
            a.seatNumber ? `#${a.seatNumber}` : 'Waitlist',
            a.allocationStatus
          ]);
        });
      });

      kpis = [
        { label: 'Total Allocations', value: rows.length },
        { label: 'Allocated Seats', value: rows.filter((r) => r[7] === 'Allocated').length },
        { label: 'Waitlisted', value: rows.filter((r) => r[7] === 'Waitlisted').length }
      ];
      break;
    }

    case 'payments': {
      title = 'Payment Transactions Ledger Report';
      const paymentMatch = {};
      if (filters.academicSession) paymentMatch.academicSession = filters.academicSession;
      if (filters.programmeId && mongoose.Types.ObjectId.isValid(filters.programmeId)) {
        paymentMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
      }
      if (filters.paymentStatus) paymentMatch.status = filters.paymentStatus;

      const payments = await Payment.find(paymentMatch)
        .populate('applicant', 'fullName email')
        .populate('programme', 'programmeCode programmeName')
        .sort({ createdAt: -1 });

      headers = [
        'Order ID',
        'Payment ID',
        'Candidate Name',
        'Email',
        'Programme',
        'Session',
        'Amount',
        'Currency',
        'Gateway',
        'Status',
        'Transaction Date'
      ];

      let successfulSum = 0;
      rows = payments.map((p) => {
        if (p.status === 'Successful') successfulSum += p.amount;
        return [
          p.orderId,
          p.paymentId || 'N/A',
          p.applicant?.fullName || 'N/A',
          p.applicant?.email || 'N/A',
          p.programme?.programmeCode || 'N/A',
          p.academicSession,
          p.amount,
          p.currency || 'INR',
          p.gateway || 'sandbox',
          p.status,
          p.paidAt ? new Date(p.paidAt).toISOString().substring(0, 10) : new Date(p.createdAt).toISOString().substring(0, 10)
        ];
      });

      kpis = [
        { label: 'Total Transactions', value: payments.length },
        { label: 'Verified Revenue', value: `₹${successfulSum.toLocaleString()}` }
      ];
      break;
    }

    case 'enrolments': {
      title = 'Confirmed Student Enrolment Directory Report';
      const enrolMatch = {};
      if (filters.academicSession) enrolMatch.academicSession = filters.academicSession;
      if (filters.programmeId && mongoose.Types.ObjectId.isValid(filters.programmeId)) {
        enrolMatch.programme = new mongoose.Types.ObjectId(filters.programmeId);
      }

      const enrolments = await Enrolment.find(enrolMatch)
        .populate('applicant', 'fullName email phone')
        .populate('programme', 'programmeCode programmeName')
        .sort({ confirmedAt: -1 });

      headers = [
        'Enrolment Number',
        'Application ID',
        'Candidate Name',
        'Email',
        'Phone',
        'Programme',
        'Session',
        'Category',
        'Seat #',
        'Payment Ref',
        'Fee Paid',
        'Confirmed At'
      ];

      let feeTotal = 0;
      rows = enrolments.map((e) => {
        feeTotal += e.feeAmountPaid || 0;
        return [
          e.enrolmentNumber,
          e.applicationId,
          e.applicant?.fullName || 'N/A',
          e.applicant?.email || 'N/A',
          e.applicant?.phone || 'N/A',
          e.programme?.programmeCode || 'N/A',
          e.academicSession,
          e.allocatedCategory,
          e.seatNumber ? `#${e.seatNumber}` : 'N/A',
          e.paymentReference,
          e.feeAmountPaid || 0,
          e.confirmedAt ? new Date(e.confirmedAt).toISOString().substring(0, 10) : 'N/A'
        ];
      });

      kpis = [
        { label: 'Total Enrolled', value: enrolments.length },
        { label: 'Total Collected', value: `₹${feeTotal.toLocaleString()}` }
      ];
      break;
    }

    case 'fee-summary': {
      title = 'Programme-Wise Fee Collection Summary';
      const enrolMatch = {};
      if (filters.academicSession) enrolMatch.academicSession = filters.academicSession;

      const [programmes, enrolments] = await Promise.all([
        Programme.find({ isActive: true }).sort({ programmeCode: 1 }),
        Enrolment.find(enrolMatch)
      ]);

      headers = [
        'Programme Code',
        'Programme Name',
        'Total Seat Capacity',
        'Enrolled Students',
        'Seat Utilization %',
        'Fee Collected (INR)'
      ];

      let grandTotalRevenue = 0;
      let grandTotalEnrolled = 0;

      rows = programmes.map((p) => {
        const progEnrols = enrolments.filter((e) => e.programme.toString() === p._id.toString());
        const enrolledCount = progEnrols.length;
        const feeCollected = progEnrols.reduce((sum, e) => sum + (e.feeAmountPaid || 0), 0);
        const capacity = p.seatCapacity?.total || 0;
        const util = capacity > 0 ? Number(((enrolledCount / capacity) * 100).toFixed(1)) : 0;

        grandTotalRevenue += feeCollected;
        grandTotalEnrolled += enrolledCount;

        return [
          p.programmeCode,
          p.programmeName,
          capacity,
          enrolledCount,
          `${util}%`,
          feeCollected
        ];
      });

      kpis = [
        { label: 'Programmes', value: programmes.length },
        { label: 'Total Enrolled', value: grandTotalEnrolled },
        { label: 'Total Revenue', value: `₹${grandTotalRevenue.toLocaleString()}` }
      ];
      break;
    }

    default:
      throw new AppError(`Unsupported report type: '${type}'`, 400);
  }

  // Format Serialization
  if (safeFormat === 'csv') {
    const csvContent = generateCsv({ headers, rows });
    return {
      contentType: 'text/csv; charset=utf-8',
      fileName: `iem-${type}-report-${Date.now()}.csv`,
      data: Buffer.from(csvContent, 'utf-8')
    };
  } else {
    const pdfBuffer = generatePdf({
      title,
      subtitle: 'Institute of Engineering & Management (IEM) — Official Report',
      session: filters.academicSession || 'All Sessions',
      filters,
      kpis,
      headers,
      rows
    });

    return {
      contentType: 'application/pdf',
      fileName: `iem-${type}-report-${Date.now()}.pdf`,
      data: pdfBuffer
    };
  }
}

module.exports = {
  getOverviewAnalytics,
  getApplicationAnalytics,
  getDocumentAnalytics,
  getMeritAnalytics,
  getPaymentAnalytics,
  exportReport
};
