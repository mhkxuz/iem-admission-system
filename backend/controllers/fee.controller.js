const feeService = require('../services/fee.service');
const ApiResponse = require('../utils/api-response');

/**
 * Admin: Create a new fee structure.
 */
async function createFeeStructure(req, res, next) {
  try {
    const feeStructure = await feeService.createFeeStructure(req.body);
    return ApiResponse.success(res, 'Fee structure created successfully.', feeStructure, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: List fee structures with filtering and pagination.
 */
async function getAllFeeStructures(req, res, next) {
  try {
    const result = await feeService.getAllFeeStructures(req.query);
    return ApiResponse.success(res, 'Fee structures retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Retrieve fee structure by ID.
 */
async function getFeeStructureById(req, res, next) {
  try {
    const feeStructure = await feeService.getFeeStructureById(req.params.id);
    return ApiResponse.success(res, 'Fee structure retrieved successfully.', feeStructure, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Update an existing fee structure.
 */
async function updateFeeStructure(req, res, next) {
  try {
    const feeStructure = await feeService.updateFeeStructure(req.params.id, req.body);
    return ApiResponse.success(res, 'Fee structure updated successfully.', feeStructure, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Activate a fee structure.
 */
async function activateFeeStructure(req, res, next) {
  try {
    const feeStructure = await feeService.activateFeeStructure(req.params.id);
    return ApiResponse.success(res, 'Fee structure activated successfully.', feeStructure, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Deactivate a fee structure.
 */
async function deactivateFeeStructure(req, res, next) {
  try {
    const feeStructure = await feeService.deactivateFeeStructure(req.params.id);
    return ApiResponse.success(res, 'Fee structure deactivated successfully.', feeStructure, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Public: Retrieve active fee information for a programme and session.
 */
async function getPublicFeeByProgramme(req, res, next) {
  try {
    const feeStructure = await feeService.getPublicFeeByProgramme(
      req.params.programmeId,
      req.query.session
    );
    return ApiResponse.success(res, 'Programme fee details retrieved successfully.', feeStructure, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Delete a fee structure.
 */
async function deleteFeeStructure(req, res, next) {
  try {
    const feeStructure = await feeService.deleteFeeStructure(req.params.id);
    return ApiResponse.success(res, 'Fee structure deleted successfully.', feeStructure, 200);
  } catch (error) {
    next(error);
  }
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
