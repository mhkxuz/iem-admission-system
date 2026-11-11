const meritService = require('../services/merit.service');
const ApiResponse = require('../utils/api-response');
const AppError = require('../utils/app-error');

/**
 * Admin: Save or update merit scoring & eligibility configuration.
 */
async function saveConfiguration(req, res, next) {
  try {
    const {
      programmeId,
      academicSession,
      class12Weightage,
      entranceExamWeightage,
      normalizationMethod,
      maxEntranceRank,
      maxEntranceScore,
      tieBreakingPriority,
      unfilledSeatRule
    } = req.body;

    if (!programmeId || !academicSession) {
      throw new AppError('programmeId and academicSession are required.', 400);
    }

    const config = await meritService.saveMeritConfiguration({
      programmeId,
      academicSession,
      class12Weightage,
      entranceExamWeightage,
      normalizationMethod,
      maxEntranceRank,
      maxEntranceScore,
      tieBreakingPriority,
      unfilledSeatRule,
      adminId: req.user._id
    });

    return ApiResponse.success(res, 'Merit configuration saved successfully.', config, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Get active merit configuration for a programme and academic session.
 */
async function getConfiguration(req, res, next) {
  try {
    const { programmeId, academicSession } = req.query;
    if (!programmeId || !academicSession) {
      throw new AppError('programmeId and academicSession query parameters are required.', 400);
    }

    const config = await meritService.getMeritConfiguration(programmeId, academicSession);
    return ApiResponse.success(res, 'Merit configuration retrieved successfully.', config, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Generate a draft merit list.
 */
async function generateMeritList(req, res, next) {
  try {
    const { programmeId, academicSession } = req.body;
    if (!programmeId || !academicSession) {
      throw new AppError('programmeId and academicSession are required in the request body.', 400);
    }

    const meritList = await meritService.generateMeritList({
      programmeId,
      academicSession,
      adminId: req.user._id
    });

    return ApiResponse.success(res, 'Merit list generated successfully.', meritList, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Retrieve merit lists with optional filters.
 */
async function getMeritLists(req, res, next) {
  try {
    const { programmeId, academicSession, status } = req.query;
    const lists = await meritService.getMeritLists({ programmeId, academicSession, status });
    return ApiResponse.success(res, 'Merit lists retrieved successfully.', lists, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Retrieve a single merit list by ID.
 */
async function getMeritListById(req, res, next) {
  try {
    const list = await meritService.getMeritListById(req.params.id);
    return ApiResponse.success(res, 'Merit list details retrieved successfully.', list, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Publish a merit list.
 */
async function publishMeritList(req, res, next) {
  try {
    const published = await meritService.publishMeritList(req.params.id, req.user._id);
    return ApiResponse.success(res, 'Merit list published successfully.', published, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Generate a draft seat allocation.
 */
async function generateSeatAllocation(req, res, next) {
  try {
    const { programmeId, academicSession, meritListId, unfilledSeatRule } = req.body;
    if (!programmeId || !academicSession) {
      throw new AppError('programmeId and academicSession are required in the request body.', 400);
    }

    const allocation = await meritService.generateSeatAllocation({
      programmeId,
      academicSession,
      meritListId,
      unfilledSeatRule,
      adminId: req.user._id
    });

    return ApiResponse.success(res, 'Seat allocation generated successfully.', allocation, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Retrieve seat allocations with optional filters.
 */
async function getSeatAllocations(req, res, next) {
  try {
    const { programmeId, academicSession, status } = req.query;
    const allocations = await meritService.getSeatAllocations({ programmeId, academicSession, status });
    return ApiResponse.success(res, 'Seat allocations retrieved successfully.', allocations, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Retrieve a single seat allocation by ID.
 */
async function getSeatAllocationById(req, res, next) {
  try {
    const allocation = await meritService.getSeatAllocationById(req.params.id);
    return ApiResponse.success(res, 'Seat allocation details retrieved successfully.', allocation, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Approve a draft seat allocation.
 */
async function approveSeatAllocation(req, res, next) {
  try {
    const { remarks } = req.body;
    const approved = await meritService.approveSeatAllocation(req.params.id, req.user._id, remarks);
    return ApiResponse.success(res, 'Seat allocation approved successfully.', approved, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Publish an approved seat allocation.
 */
async function publishSeatAllocation(req, res, next) {
  try {
    const { remarks } = req.body;
    const published = await meritService.publishSeatAllocation(req.params.id, req.user._id, remarks);
    return ApiResponse.success(res, 'Seat allocation published successfully.', published, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Applicant: Retrieve published merit score, rank, and seat allocation result.
 */
async function getMyMeritResult(req, res, next) {
  try {
    const result = await meritService.getApplicantPublishedResult(req.user._id);
    return ApiResponse.success(res, 'Merit and seat allocation result retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Applicant: Retrieve the full officially published merit list for their programme & session.
 */
async function getApplicantPublishedList(req, res, next) {
  try {
    const result = await meritService.getApplicantPublishedMeritList(req.user._id);
    return ApiResponse.success(res, 'Published merit list retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  saveConfiguration,
  getConfiguration,
  generateMeritList,
  getMeritLists,
  getMeritListById,
  publishMeritList,
  generateSeatAllocation,
  getSeatAllocations,
  getSeatAllocationById,
  approveSeatAllocation,
  publishSeatAllocation,
  getMyMeritResult,
  getApplicantPublishedList
};
