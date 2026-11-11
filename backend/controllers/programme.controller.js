const programmeService = require('../services/programme.service');
const ApiResponse = require('../utils/api-response');

/**
 * Admin: Create a new academic programme.
 */
async function createProgramme(req, res, next) {
  try {
    const programme = await programmeService.createProgramme(req.body);
    return ApiResponse.success(res, 'Academic programme created successfully.', programme, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: List programmes with search, filtering and pagination.
 */
async function getAllProgrammes(req, res, next) {
  try {
    const result = await programmeService.getAllAdminProgrammes(req.query);
    return ApiResponse.success(res, 'Academic programmes retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Retrieve programme details by ID.
 */
async function getProgrammeById(req, res, next) {
  try {
    const programme = await programmeService.getProgrammeById(req.params.id);
    return ApiResponse.success(res, 'Academic programme retrieved successfully.', programme, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Update an existing programme.
 */
async function updateProgramme(req, res, next) {
  try {
    const programme = await programmeService.updateProgramme(req.params.id, req.body);
    return ApiResponse.success(res, 'Academic programme updated successfully.', programme, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Activate a programme.
 */
async function activateProgramme(req, res, next) {
  try {
    const programme = await programmeService.activateProgramme(req.params.id);
    return ApiResponse.success(res, `Academic programme '${programme.programmeCode}' activated successfully.`, programme, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Deactivate a programme.
 */
async function deactivateProgramme(req, res, next) {
  try {
    const programme = await programmeService.deactivateProgramme(req.params.id);
    return ApiResponse.success(res, `Academic programme '${programme.programmeCode}' deactivated successfully.`, programme, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Public: List active academic programmes.
 */
async function getPublicProgrammes(req, res, next) {
  try {
    const programmes = await programmeService.getPublicProgrammes(req.query);
    return ApiResponse.success(res, 'Active academic programmes retrieved successfully.', programmes, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Public: Retrieve active programme by ID.
 */
async function getPublicProgrammeById(req, res, next) {
  try {
    const programme = await programmeService.getPublicProgrammeById(req.params.id);
    return ApiResponse.success(res, 'Academic programme details retrieved successfully.', programme, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Public: Retrieve active programme by code.
 */
async function getPublicProgrammeByCode(req, res, next) {
  try {
    const programme = await programmeService.getPublicProgrammeByCode(req.params.code);
    return ApiResponse.success(res, 'Academic programme details retrieved successfully.', programme, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Delete a programme if no applications reference it.
 */
async function deleteProgramme(req, res, next) {
  try {
    const programme = await programmeService.deleteProgramme(req.params.id);
    return ApiResponse.success(
      res,
      `Academic programme '${programme.programmeCode}' deleted successfully.`,
      programme,
      200
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createProgramme,
  getAllProgrammes,
  getProgrammeById,
  updateProgramme,
  activateProgramme,
  deactivateProgramme,
  deleteProgramme,
  getPublicProgrammes,
  getPublicProgrammeById,
  getPublicProgrammeByCode
};
