const mongoose = require('mongoose');
const { AcademicSession } = require('../models');
const AppError = require('../utils/app-error');

/**
 * Detect whether the connected MongoDB deployment supports multi-document transactions.
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
 * Create a new admission session.
 */
async function createSession(data) {
  const sessionName = data.sessionName ? data.sessionName.trim() : '';
  const sessionCode = data.sessionCode ? data.sessionCode.trim().toUpperCase() : '';

  if (!sessionName) {
    throw new AppError('Session name is required.', 400);
  }
  if (!sessionCode) {
    throw new AppError('Session code is required.', 400);
  }

  // Check unique sessionName and sessionCode
  const existing = await AcademicSession.findOne({
    $or: [{ sessionName }, { sessionCode }]
  });

  if (existing) {
    if (existing.sessionName.toLowerCase() === sessionName.toLowerCase()) {
      throw new AppError(`Admission session with name '${sessionName}' already exists.`, 409);
    }
    if (existing.sessionCode.toUpperCase() === sessionCode.toUpperCase()) {
      throw new AppError(`Admission session with code '${sessionCode}' already exists.`, 409);
    }
  }

  // Parse dates if provided
  const parsedData = {
    sessionName,
    sessionCode,
    description: data.description ? data.description.trim() : '',
    status: data.status || 'Draft',
    isActive: Boolean(data.isActive)
  };

  if (data.startDate) parsedData.startDate = new Date(data.startDate);
  if (data.endDate) parsedData.endDate = new Date(data.endDate);
  if (data.applicationStartDate) parsedData.applicationStartDate = new Date(data.applicationStartDate);
  if (data.applicationEndDate) parsedData.applicationEndDate = new Date(data.applicationEndDate);

  // If created as active, perform activation to guarantee only one session is active
  if (parsedData.isActive || parsedData.status === 'Active') {
    parsedData.isActive = true;
    parsedData.status = 'Active';

    // If transactions supported, wrap in session
    if (await deploymentSupportsTransactions()) {
      const mongoSession = await mongoose.startSession();
      try {
        let created = null;
        await mongoSession.withTransaction(async () => {
          await AcademicSession.updateMany(
            { isActive: true },
            { $set: { isActive: false } },
            { session: mongoSession }
          );
          const [doc] = await AcademicSession.create([parsedData], { session: mongoSession });
          created = doc;
        });
        return created;
      } finally {
        await mongoSession.endSession();
      }
    } else {
      await AcademicSession.updateMany({ isActive: true }, { $set: { isActive: false } });
      const created = await AcademicSession.create(parsedData);
      return created;
    }
  }

  const created = await AcademicSession.create(parsedData);
  return created;
}

/**
 * List all admission sessions.
 */
async function getAllSessions(filter = {}) {
  const query = {};
  if (filter.status && ['Draft', 'Active', 'Closed'].includes(filter.status)) {
    query.status = filter.status;
  }
  if (filter.isActive !== undefined) {
    query.isActive = filter.isActive === 'true' || filter.isActive === true;
  }

  return AcademicSession.find(query).sort({ createdAt: -1 });
}

/**
 * Retrieve a specific session by ID.
 */
async function getSessionById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid admission session ID.', 400);
  }

  const session = await AcademicSession.findById(id);
  if (!session) {
    throw new AppError('Admission session not found.', 404);
  }
  return session;
}

/**
 * Update an existing session.
 */
async function updateSession(id, updateData) {
  const session = await getSessionById(id);

  // If updating sessionName or sessionCode, verify uniqueness
  if (updateData.sessionName && updateData.sessionName.trim() !== session.sessionName) {
    const existing = await AcademicSession.findOne({
      _id: { $ne: id },
      sessionName: updateData.sessionName.trim()
    });
    if (existing) {
      throw new AppError(
        `Admission session with name '${updateData.sessionName.trim()}' already exists.`,
        409
      );
    }
    session.sessionName = updateData.sessionName.trim();
  }

  if (updateData.sessionCode && updateData.sessionCode.trim().toUpperCase() !== session.sessionCode) {
    const existing = await AcademicSession.findOne({
      _id: { $ne: id },
      sessionCode: updateData.sessionCode.trim().toUpperCase()
    });
    if (existing) {
      throw new AppError(
        `Admission session with code '${updateData.sessionCode.trim().toUpperCase()}' already exists.`,
        409
      );
    }
    session.sessionCode = updateData.sessionCode.trim().toUpperCase();
  }

  if (updateData.description !== undefined) {
    session.description = updateData.description.trim();
  }

  if (updateData.startDate !== undefined) {
    session.startDate = updateData.startDate ? new Date(updateData.startDate) : undefined;
  }
  if (updateData.endDate !== undefined) {
    session.endDate = updateData.endDate ? new Date(updateData.endDate) : undefined;
  }
  if (updateData.applicationStartDate !== undefined) {
    session.applicationStartDate = updateData.applicationStartDate
      ? new Date(updateData.applicationStartDate)
      : undefined;
  }
  if (updateData.applicationEndDate !== undefined) {
    session.applicationEndDate = updateData.applicationEndDate
      ? new Date(updateData.applicationEndDate)
      : undefined;
  }

  // Handle status/active transitions via update
  if (updateData.status === 'Closed') {
    return closeSession(id);
  }

  if (updateData.isActive === true || updateData.status === 'Active') {
    await session.save();
    return activateSession(id);
  }

  if (updateData.status && ['Draft', 'Active', 'Closed'].includes(updateData.status)) {
    session.status = updateData.status;
  }

  if (updateData.isActive !== undefined) {
    session.isActive = Boolean(updateData.isActive);
  }

  await session.save();
  return session;
}

/**
 * Activate an admission session, deactivating any previously active session.
 */
async function activateSession(id) {
  const sessionToActivate = await getSessionById(id);

  if (sessionToActivate.status === 'Closed') {
    throw new AppError(
      'Cannot activate a closed admission session. Please create a new session or reopen it.',
      400
    );
  }

  // Date validation check
  if (
    sessionToActivate.startDate &&
    sessionToActivate.endDate &&
    sessionToActivate.startDate > sessionToActivate.endDate
  ) {
    throw new AppError('Session start date cannot be later than end date.', 400);
  }

  if (
    sessionToActivate.applicationStartDate &&
    sessionToActivate.applicationEndDate &&
    sessionToActivate.applicationStartDate > sessionToActivate.applicationEndDate
  ) {
    throw new AppError(
      'Application start date cannot be later than application end date.',
      400
    );
  }

  if (await deploymentSupportsTransactions()) {
    const mongoSession = await mongoose.startSession();
    try {
      let result = null;
      await mongoSession.withTransaction(async () => {
        // Deactivate all other sessions
        await AcademicSession.updateMany(
          { _id: { $ne: sessionToActivate._id }, isActive: true },
          { $set: { isActive: false } },
          { session: mongoSession }
        );

        result = await AcademicSession.findByIdAndUpdate(
          sessionToActivate._id,
          { $set: { isActive: true, status: 'Active' } },
          { new: true, runValidators: true, session: mongoSession }
        );
      });
      return result;
    } finally {
      await mongoSession.endSession();
    }
  } else {
    // Standalone fallback
    await AcademicSession.updateMany(
      { _id: { $ne: sessionToActivate._id }, isActive: true },
      { $set: { isActive: false } }
    );
    const result = await AcademicSession.findByIdAndUpdate(
      sessionToActivate._id,
      { $set: { isActive: true, status: 'Active' } },
      { new: true, runValidators: true }
    );
    return result;
  }
}

/**
 * Close an admission session.
 */
async function closeSession(id) {
  const session = await getSessionById(id);

  session.status = 'Closed';
  session.isActive = false;
  await session.save();
  return session;
}

/**
 * Publicly retrieve the active admission session with application availability.
 */
async function getActiveSession() {
  let session = await AcademicSession.findOne({ isActive: true });

  // If no sessions exist at all in database, auto-initialize the default '2026-2027' session
  if (!session && (await AcademicSession.countDocuments()) === 0) {
    session = await ensureDefaultSession();
  }

  if (!session) {
    return null;
  }

  const now = new Date();
  let isApplicationOpen = session.isActive && session.status === 'Active';

  if (session.applicationStartDate && now < session.applicationStartDate) {
    isApplicationOpen = false;
  }
  if (session.applicationEndDate && now > session.applicationEndDate) {
    isApplicationOpen = false;
  }

  // Public representation (excluding internal metadata)
  return {
    _id: session._id,
    sessionName: session.sessionName,
    sessionCode: session.sessionCode,
    startDate: session.startDate,
    endDate: session.endDate,
    applicationStartDate: session.applicationStartDate,
    applicationEndDate: session.applicationEndDate,
    status: session.status,
    isActive: session.isActive,
    description: session.description,
    isApplicationOpen
  };
}

/**
 * Idempotent seed/init helper for the default '2026-2027' session.
 */
async function ensureDefaultSession() {
  const existing = await AcademicSession.findOne({
    $or: [{ sessionName: '2026-2027' }, { sessionCode: '2026-2027' }]
  });

  if (!existing) {
    const hasAnyActive = await AcademicSession.exists({ isActive: true });
    return await AcademicSession.create({
      sessionName: '2026-2027',
      sessionCode: '2026-2027',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2027-06-30'),
      applicationStartDate: new Date('2026-01-01'),
      applicationEndDate: new Date('2026-12-31'),
      status: 'Active',
      isActive: !hasAnyActive,
      description: 'Official academic admission session for 2026-2027'
    });
  }

  return existing;
}

/**
 * Admin: Delete a session if no applications or programmes reference it.
 */
async function deleteSession(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid session ID format.', 400);
  }

  const session = await AcademicSession.findById(id);
  if (!session) {
    throw new AppError('Academic session not found.', 404);
  }

  const { Application, Programme } = require('../models');
  const appCount = await Application.countDocuments({ academicSession: session.sessionName });
  if (appCount > 0) {
    throw new AppError(
      `Cannot delete session: ${appCount} application(s) reference session '${session.sessionName}'. Please close the session instead to preserve historical records.`,
      400
    );
  }

  const progCount = await Programme.countDocuments({
    $or: [{ academicSession: session._id }, { offeredSessions: session._id }]
  });
  if (progCount > 0) {
    throw new AppError(
      `Cannot delete session: ${progCount} programme(s) reference this session.`,
      400
    );
  }

  await AcademicSession.findByIdAndDelete(id);
  return session;
}

module.exports = {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  activateSession,
  closeSession,
  deleteSession,
  getActiveSession,
  ensureDefaultSession
};
