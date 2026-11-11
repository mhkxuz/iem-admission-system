const mongoose = require('mongoose');
const FeeStructure = require('../models/fee-structure.model');
const Programme = require('../models/programme.model');
const AcademicSession = require('../models/academic-session.model');
const AppError = require('../utils/app-error');

/**
 * Helper to resolve an AcademicSession reference from an ID, name, or code.
 */
async function resolveSessionId(sessionIdentifier) {
  if (!sessionIdentifier) return null;

  if (mongoose.Types.ObjectId.isValid(sessionIdentifier)) {
    const session = await AcademicSession.findById(sessionIdentifier);
    if (!session) {
      throw new AppError(`Academic session with ID '${sessionIdentifier}' does not exist.`, 404);
    }
    return session._id;
  }

  const session = await AcademicSession.findOne({
    $or: [{ sessionName: sessionIdentifier }, { sessionCode: sessionIdentifier }]
  });

  if (!session) {
    throw new AppError(`Academic session '${sessionIdentifier}' does not exist.`, 404);
  }

  return session._id;
}

/**
 * Helper to resolve a Programme reference from an ID or code.
 */
async function resolveProgrammeId(programmeIdentifier) {
  if (!programmeIdentifier) {
    throw new AppError('Programme reference is required.', 400);
  }

  if (mongoose.Types.ObjectId.isValid(programmeIdentifier)) {
    const programme = await Programme.findById(programmeIdentifier);
    if (!programme) {
      throw new AppError(`Academic programme with ID '${programmeIdentifier}' does not exist.`, 404);
    }
    return programme._id;
  }

  const programme = await Programme.findOne({
    programmeCode: programmeIdentifier.trim().toUpperCase()
  });

  if (!programme) {
    throw new AppError(`Academic programme with code '${programmeIdentifier}' does not exist.`, 404);
  }

  return programme._id;
}

/**
 * Create a new fee structure.
 * Enforces single active fee structure per (programme, academicSession) by deactivating previous versions.
 */
async function createFeeStructure(feeData) {
  const programmeId = await resolveProgrammeId(feeData.programme);

  let sessionId;
  if (feeData.academicSession) {
    sessionId = await resolveSessionId(feeData.academicSession);
  } else {
    // Default to the programme's primary session or currently active session
    const prog = await Programme.findById(programmeId);
    if (prog && prog.academicSession) {
      sessionId = prog.academicSession;
    } else {
      const activeSession = await AcademicSession.findOne({ isActive: true, status: 'Active' });
      if (!activeSession) {
        throw new AppError('Academic session is required and no active session currently exists.', 400);
      }
      sessionId = activeSession._id;
    }
  }

  const isActive = feeData.isActive !== false;

  // If this fee structure is active, deactivate existing active fee structures for this programme & session
  if (isActive) {
    await FeeStructure.updateMany(
      { programme: programmeId, academicSession: sessionId, isActive: true },
      { $set: { isActive: false } }
    );
  }

  const feeStructure = new FeeStructure({
    ...feeData,
    programme: programmeId,
    academicSession: sessionId,
    isActive
  });

  await feeStructure.save();

  return FeeStructure.findById(feeStructure._id)
    .populate('programme', 'programmeName programmeCode department degree duration durationUnit')
    .populate('academicSession', 'sessionName sessionCode isActive status');
}

/**
 * List fee structures with filtering and pagination (Admin).
 */
async function getAllFeeStructures(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.programme && query.programme.trim()) {
    try {
      filter.programme = await resolveProgrammeId(query.programme.trim());
    } catch {
      return { feeStructures: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  const sessionParam = query.academicSession || query.session;
  if (sessionParam && sessionParam.trim()) {
    try {
      filter.academicSession = await resolveSessionId(sessionParam.trim());
    } catch {
      return { feeStructures: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  const [feeStructures, total] = await Promise.all([
    FeeStructure.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('programme', 'programmeName programmeCode department degree duration durationUnit')
      .populate('academicSession', 'sessionName sessionCode isActive status'),
    FeeStructure.countDocuments(filter)
  ]);

  return {
    feeStructures,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Retrieve a fee structure by ID.
 */
async function getFeeStructureById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid fee structure ID format.', 400);
  }

  const feeStructure = await FeeStructure.findById(id)
    .populate('programme', 'programmeName programmeCode department degree duration durationUnit')
    .populate('academicSession', 'sessionName sessionCode isActive status');

  if (!feeStructure) {
    throw new AppError('Fee structure not found.', 404);
  }

  return feeStructure;
}

/**
 * Update a fee structure.
 */
async function updateFeeStructure(id, updateData) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid fee structure ID format.', 400);
  }

  const feeStructure = await FeeStructure.findById(id);
  if (!feeStructure) {
    throw new AppError('Fee structure not found.', 404);
  }

  // If activating, deactivate others for same (programme, academicSession)
  if (updateData.isActive === true && !feeStructure.isActive) {
    await FeeStructure.updateMany(
      {
        programme: feeStructure.programme,
        academicSession: feeStructure.academicSession,
        _id: { $ne: id },
        isActive: true
      },
      { $set: { isActive: false } }
    );
  }

  const allowedFields = [
    'applicationFee',
    'admissionFee',
    'semesterFees',
    'additionalFees',
    'totalProgrammeFee',
    'currency',
    'paymentInstructions',
    'isActive'
  ];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      feeStructure[field] = updateData[field];
    }
  }

  await feeStructure.save();

  return FeeStructure.findById(feeStructure._id)
    .populate('programme', 'programmeName programmeCode department degree duration durationUnit')
    .populate('academicSession', 'sessionName sessionCode isActive status');
}

/**
 * Activate a fee structure.
 */
async function activateFeeStructure(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid fee structure ID format.', 400);
  }

  const feeStructure = await FeeStructure.findById(id);
  if (!feeStructure) {
    throw new AppError('Fee structure not found.', 404);
  }

  // Deactivate any existing active fee structure for same programme and session
  await FeeStructure.updateMany(
    {
      programme: feeStructure.programme,
      academicSession: feeStructure.academicSession,
      _id: { $ne: id },
      isActive: true
    },
    { $set: { isActive: false } }
  );

  feeStructure.isActive = true;
  await feeStructure.save();

  return FeeStructure.findById(feeStructure._id)
    .populate('programme', 'programmeName programmeCode department degree duration durationUnit')
    .populate('academicSession', 'sessionName sessionCode isActive status');
}

/**
 * Deactivate a fee structure.
 */
async function deactivateFeeStructure(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid fee structure ID format.', 400);
  }

  const feeStructure = await FeeStructure.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true, runValidators: true }
  )
    .populate('programme', 'programmeName programmeCode department degree duration durationUnit')
    .populate('academicSession', 'sessionName sessionCode isActive status');

  if (!feeStructure) {
    throw new AppError('Fee structure not found.', 404);
  }

  return feeStructure;
}

/**
 * Publicly retrieve active fee information for a programme and session.
 */
async function getPublicFeeByProgramme(programmeIdentifier, sessionIdentifier) {
  const programmeId = await resolveProgrammeId(programmeIdentifier);

  let targetSessionId;
  if (sessionIdentifier && sessionIdentifier.trim()) {
    targetSessionId = await resolveSessionId(sessionIdentifier.trim());
  } else {
    // Resolve currently active academic session
    const activeSession = await AcademicSession.findOne({ isActive: true, status: 'Active' });
    if (activeSession) {
      targetSessionId = activeSession._id;
    } else {
      // Fallback to the programme's primary session
      const prog = await Programme.findById(programmeId);
      if (prog && prog.academicSession) {
        targetSessionId = prog.academicSession;
      }
    }
  }

  const query = {
    programme: programmeId,
    isActive: true
  };

  if (targetSessionId) {
    query.academicSession = targetSessionId;
  }

  const feeStructure = await FeeStructure.findOne(query)
    .sort({ createdAt: -1 })
    .populate('programme', 'programmeName programmeCode department degree duration durationUnit')
    .populate('academicSession', 'sessionName sessionCode isActive status');

  if (!feeStructure) {
    throw new AppError('No active fee structure found for the specified programme and session.', 404);
  }

  return feeStructure;
}

/**
 * Admin: Delete a fee structure.
 */
async function deleteFeeStructure(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid fee structure ID format.', 400);
  }

  const fee = await FeeStructure.findByIdAndDelete(id);
  if (!fee) {
    throw new AppError('Fee structure not found.', 404);
  }

  return fee;
}

module.exports = {
  createFeeStructure,
  getAllFeeStructures,
  getFeeStructureById,
  updateFeeStructure,
  activateFeeStructure,
  deactivateFeeStructure,
  deleteFeeStructure,
  getPublicFeeByProgramme
};
