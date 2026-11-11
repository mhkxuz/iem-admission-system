const mongoose = require('mongoose');
const {
  User,
  Application,
  UploadedDocument,
  ApplicationStatusHistory,
  AcademicSession,
  Programme,
  FeeStructure
} = require('../models');
const AppError = require('../utils/app-error');
const {
  isValidStatus,
  getAllowedNextStatuses,
  validateStatusTransition
} = require('./status-workflow.service');
const { getDashboardStatistics } = require('./dashboard-statistics.service');

const MAX_REMARKS_LENGTH = 1000;

/**
 * Escapes characters with special meaning in regex to prevent ReDoS / query injection.
 */
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Retrieve administrative dashboard metrics, status/department/category
 * distributions and recent submissions.
 *
 * Counts and groupings are produced by MongoDB aggregation pipelines (Stage 7).
 */
async function getDashboardOverview() {
  const [
    statistics,
    recentApplications,
    totalProgrammes,
    activeProgrammes,
    openProgrammes,
    totalSessions,
    activeSessionDoc,
    activeFeeCount
  ] = await Promise.all([
    getDashboardStatistics(),
    Application.find()
      .sort({ submittedAt: -1 })
      .limit(5)
      .populate('applicant', 'fullName email'),
    Programme.countDocuments(),
    Programme.countDocuments({ isActive: true }),
    Programme.countDocuments({ isActive: true, isApplicationOpen: true }),
    AcademicSession.countDocuments(),
    AcademicSession.findOne({ isActive: true }).select('sessionName sessionCode status applicationStartDate applicationEndDate'),
    FeeStructure.countDocuments({ isActive: true })
  ]);

  return {
    ...statistics,
    recentApplications,
    academicOverview: {
      totalProgrammes,
      activeProgrammes,
      programmesAcceptingApplications: openProgrammes,
      totalSessions,
      activeSession: activeSessionDoc ? activeSessionDoc.sessionName : 'None',
      activeSessionDetails: activeSessionDoc || null,
      configuredFeeStructures: activeFeeCount,
      programmesMissingFee: Math.max(0, activeProgrammes - activeFeeCount)
    }
  };
}

/**
 * Query applications with backend filtering, searching, sorting and pagination.
 */
async function getApplications(queryParams = {}) {
  const filter = {};

  // 1. Text Search across Application ID, Applicant Full Name and Email
  if (queryParams.search && typeof queryParams.search === 'string' && queryParams.search.trim().length > 0) {
    const term = escapeRegex(queryParams.search.trim());
    filter.$or = [
      { applicationId: { $regex: term, $options: 'i' } },
      { 'personalInfo.fullName': { $regex: term, $options: 'i' } },
      { 'personalInfo.email': { $regex: term, $options: 'i' } }
    ];
  }

  // 2. Department Filter
  if (queryParams.department && typeof queryParams.department === 'string' && queryParams.department.trim().length > 0) {
    filter['admissionInfo.preferredDepartment'] = queryParams.department.trim();
  }

  // 3. Admission Category Filter
  if (queryParams.category && typeof queryParams.category === 'string' && queryParams.category.trim().length > 0) {
    filter['admissionInfo.admissionCategory'] = queryParams.category.trim();
  }

  // 4. Application Status Filter
  if (queryParams.status && typeof queryParams.status === 'string' && queryParams.status.trim().length > 0) {
    filter.status = queryParams.status.trim();
  }

  // 5. Academic Session Filter
  if (queryParams.session && typeof queryParams.session === 'string' && queryParams.session.trim().length > 0) {
    filter.academicSession = queryParams.session.trim();
  }

  // 6. Sorting
  const sort = {};
  const allowedSortFields = {
    submittedAt: 'submittedAt',
    applicationId: 'applicationId',
    name: 'personalInfo.fullName',
    percentage: 'academicInfo.class12Percentage',
    status: 'status'
  };

  const sortFieldKey = queryParams.sortBy || 'submittedAt';
  const mongoSortField = allowedSortFields[sortFieldKey] || 'submittedAt';
  const sortOrder = queryParams.sortOrder && queryParams.sortOrder.toLowerCase() === 'asc' ? 1 : -1;
  sort[mongoSortField] = sortOrder;

  // 7. Pagination
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 10));
  const skip = (page - 1) * limit;

  // Execute count and query concurrently
  const [totalRecords, applications] = await Promise.all([
    Application.countDocuments(filter),
    Application.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('applicant', 'fullName email phone')
  ]);

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return {
    applications,
    pagination: {
      totalRecords,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}

/**
 * Retrieve comprehensive details for a specific application including attached documents & status audit trail.
 */
async function getApplicationDetails(idOrAppId) {
  const query = idOrAppId.toString().startsWith('IEM-')
    ? { applicationId: idOrAppId }
    : { _id: idOrAppId };

  const application = await Application.findOne(query).populate('applicant', 'fullName email phone createdAt');

  if (!application) {
    throw new AppError('Application not found.', 404);
  }

  // Concurrently fetch uploaded documents and status history.
  // History is returned oldest-first so the UI can present a chronological audit trail.
  const [documents, statusHistory] = await Promise.all([
    UploadedDocument.find({ application: application._id })
      .sort({ uploadedAt: -1 })
      .populate('verifiedBy', 'fullName role email'),
    ApplicationStatusHistory.find({ application: application._id })
      .sort({ timestamp: 1, createdAt: 1 })
      .populate('changedBy', 'fullName role email')
  ]);

  const appObj = application.toObject();
  appObj.documents = documents;
  appObj.statusHistory = statusHistory;
  appObj.allowedNextStatuses = getAllowedNextStatuses(application.status);

  return appObj;
}

/**
 * Detect whether the connected MongoDB deployment supports multi-document
 * transactions. Standalone mongod deployments do not.
 */
async function deploymentSupportsTransactions() {
  try {
    if (!mongoose.connection.db) {
      return false;
    }
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    return Boolean(hello.setName) || hello.msg === 'isdbgrid';
  } catch (error) {
    return false;
  }
}

/**
 * MongoDB reports unsupported transactions with this message/code when the
 * deployment is a standalone server. We fall back to the compensating
 * strategy in that case.
 */
function isTransactionUnsupportedError(error) {
  if (!error) {
    return false;
  }
  const message = error.message || '';
  return (
    error.code === 20 ||
    /transaction numbers are only allowed|does not support transactions|replica set member or mongos/i.test(
      message
    )
  );
}

/**
 * Build the audit-history payload from server-trusted values only.
 */
function buildHistoryPayload(context) {
  return {
    application: context.applicationId,
    previousStatus: context.previousStatus,
    newStatus: context.requestedStatus,
    changedBy: context.adminId,
    remarks: context.remarks
  };
}

/**
 * Transactional status update: the application status and its audit record are
 * committed together or not at all.
 */
async function applyStatusUpdateInTransaction(context) {
  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      const updatedApplication = await Application.findOneAndUpdate(
        { _id: context.applicationId, status: context.previousStatus },
        { $set: { status: context.requestedStatus } },
        { new: true, runValidators: true, session }
      );

      if (!updatedApplication) {
        throw new AppError(
          'Application status was modified by another administrator. Please refresh and try again.',
          409
        );
      }

      const [history] = await ApplicationStatusHistory.create(
        [buildHistoryPayload(context)],
        { session }
      );

      result = { application: updatedApplication, history };
    });

    if (!result) {
      throw new AppError('Status update could not be completed. Please try again.', 409);
    }

    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Fallback for standalone MongoDB deployments without transactions.
 *
 * The audit record is written first, then the status is changed with an atomic
 * conditional update. If the update fails (for example because another
 * administrator changed the status concurrently), the just-created audit
 * record is removed. This guarantees a status can never change without a
 * corresponding audit record, and concurrent administrators cannot create
 * duplicate successful histories.
 */
async function applyStatusUpdateWithCompensation(context) {
  const history = await ApplicationStatusHistory.create(buildHistoryPayload(context));

  try {
    const updatedApplication = await Application.findOneAndUpdate(
      { _id: context.applicationId, status: context.previousStatus },
      { $set: { status: context.requestedStatus } },
      { new: true, runValidators: true }
    );

    if (!updatedApplication) {
      await ApplicationStatusHistory.deleteOne({ _id: history._id });
      throw new AppError(
        'Application status was modified by another administrator. Please refresh and try again.',
        409
      );
    }

    return { application: updatedApplication, history };
  } catch (error) {
    // Remove the audit record unless it was already removed by the conflict
    // branch above. This keeps failed updates from leaving orphaned history.
    try {
      await ApplicationStatusHistory.deleteOne({ _id: history._id });
    } catch (cleanupError) {
      console.error(
        '[Status Workflow] Failed to remove audit record after a failed status update:',
        cleanupError
      );
    }
    throw error;
  }
}

/**
 * Update an application status through the strict workflow and persist the
 * corresponding audit-history entry.
 *
 * Security notes:
 * - adminId must come from the authenticated JWT context.
 * - previousStatus is always read from the database.
 * - changedBy/previousStatus/applicant values supplied by clients are ignored.
 */
async function updateApplicationStatus(idOrAppId, requestedStatusInput, remarksInput, adminId) {
  if (typeof requestedStatusInput !== 'string' || requestedStatusInput.trim().length === 0) {
    throw new AppError('Requested status is required.', 400);
  }

  const requestedStatus = requestedStatusInput.trim();

  if (!isValidStatus(requestedStatus)) {
    throw new AppError(
      `Invalid status '${requestedStatus}'. Permitted statuses are: Submitted, Under Review, Selected, Rejected.`,
      400
    );
  }

  if (remarksInput !== undefined && remarksInput !== null && typeof remarksInput !== 'string') {
    throw new AppError('Remarks must be a string.', 400);
  }

  const remarks = typeof remarksInput === 'string' ? remarksInput.trim() : '';

  if (remarks.length > MAX_REMARKS_LENGTH) {
    throw new AppError(`Remarks cannot exceed ${MAX_REMARKS_LENGTH} characters.`, 400);
  }

  if (!idOrAppId || typeof idOrAppId !== 'string' || idOrAppId.trim().length === 0) {
    throw new AppError('A valid application ID is required.', 400);
  }

  const identifier = idOrAppId.trim();
  const query = identifier.startsWith('IEM-')
    ? { applicationId: identifier }
    : { _id: identifier };

  // Read the current status from the database; never trust a client value.
  const application = await Application.findOne(query).select('_id status');

  if (!application) {
    throw new AppError('Application not found.', 404);
  }

  // Centralized state-machine validation.
  validateStatusTransition(application.status, requestedStatus);

  const context = {
    applicationId: application._id,
    previousStatus: application.status,
    requestedStatus,
    remarks,
    adminId
  };

  let result;

  if (await deploymentSupportsTransactions()) {
    try {
      result = await applyStatusUpdateInTransaction(context);
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }
      result = await applyStatusUpdateWithCompensation(context);
    }
  } else {
    result = await applyStatusUpdateWithCompensation(context);
  }

  const populatedHistory = await ApplicationStatusHistory.findById(result.history._id).populate(
    'changedBy',
    'fullName role email'
  );

  return {
    application: result.application.toObject(),
    history: populatedHistory || result.history,
    previousStatus: context.previousStatus,
    newStatus: context.requestedStatus,
    allowedNextStatuses: getAllowedNextStatuses(context.requestedStatus)
  };
}

/**
 * List users with role filtering, search, and pagination.
 */
async function getUsers({ role, search, page = 1, limit = 50 }) {
  const query = {};
  if (role && role !== 'all') {
    query.role = role;
  }
  if (search && search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    query.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 50);
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    User.countDocuments(query)
  ]);

  return {
    users,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1
    }
  };
}

/**
 * Assign or revoke reviewer access, or update user role.
 * Protects administrators from demoting themselves to prevent accidental lockout.
 */
async function updateUserRole({ targetUserId, newRole, adminId }) {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError('Invalid user ID format.', 400);
  }

  const ALLOWED_ROLES = ['applicant', 'reviewer', 'admin'];
  if (!newRole || !ALLOWED_ROLES.includes(newRole)) {
    throw new AppError(
      `Invalid role '${newRole}'. Allowed roles are: ${ALLOWED_ROLES.join(', ')}`,
      400
    );
  }

  if (targetUserId.toString() === adminId.toString() && newRole !== 'admin') {
    throw new AppError('Administrators cannot demote their own account.', 400);
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  user.role = newRole;
  await user.save();

  return user;
}

/**
 * Create a new user with reviewer role.
 */
async function createReviewer({ fullName, email, password, phone }) {
  if (!fullName || !email || !password) {
    throw new AppError('Full name, email, and password are required.', 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new AppError('A user with this email address already exists.', 409);
  }

  const user = await User.create({
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    password,
    role: 'reviewer',
    phone: phone ? phone.trim() : ''
  });

  return user;
}

module.exports = {
  getDashboardOverview,
  getApplications,
  getApplicationDetails,
  updateApplicationStatus,
  getUsers,
  updateUserRole,
  createReviewer
};
