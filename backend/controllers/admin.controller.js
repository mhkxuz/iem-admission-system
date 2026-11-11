const adminService = require('../services/admin.service');
const ApiResponse = require('../utils/api-response');

/**
 * Handle dashboard summary statistics retrieval
 */
async function getDashboard(req, res, next) {
  try {
    const data = await adminService.getDashboardOverview();
    return ApiResponse.success(res, 'Admin dashboard metrics retrieved.', data, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle applications list retrieval with filtering, search, and pagination
 */
async function getApplications(req, res, next) {
  try {
    const { applications, pagination } = await adminService.getApplications(req.query);
    return ApiResponse.success(
      res,
      'Applications retrieved successfully.',
      applications,
      200,
      pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Handle detailed application inspection
 */
async function getApplicationById(req, res, next) {
  try {
    const application = await adminService.getApplicationDetails(req.params.id);
    return ApiResponse.success(
      res,
      'Application details retrieved.',
      application,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Handle an administrator-driven application status transition.
 * Only the status and optional remarks are read from the body. The
 * administrator identity and previous status are always server-derived.
 */
async function updateApplicationStatus(req, res, next) {
  try {
    const result = await adminService.updateApplicationStatus(
      req.params.id,
      req.body ? req.body.status : undefined,
      req.body ? req.body.remarks : undefined,
      req.userId
    );

    return ApiResponse.success(
      res,
      `Application status updated from '${result.previousStatus}' to '${result.newStatus}'.`,
      result,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Handle user listing for administration / role assignment
 */
async function getUsers(req, res, next) {
  try {
    const result = await adminService.getUsers({
      role: req.query.role,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit
    });

    return ApiResponse.success(
      res,
      'Users retrieved successfully.',
      result.users,
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Handle role assignment / revocation (e.g. assigning reviewer role)
 */
async function updateUserRole(req, res, next) {
  try {
    const updatedUser = await adminService.updateUserRole({
      targetUserId: req.params.id,
      newRole: req.body.role,
      adminId: req.userId
    });

    return ApiResponse.success(
      res,
      `User '${updatedUser.fullName}' role updated to '${updatedUser.role}'.`,
      updatedUser,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Handle direct creation of reviewer account
 */
async function createReviewer(req, res, next) {
  try {
    const reviewer = await adminService.createReviewer(req.body);
    return ApiResponse.success(
      res,
      `Reviewer account '${reviewer.email}' created successfully.`,
      reviewer,
      201
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get applications that lack a selectedProgramme (legacy / unmapped).
 */
async function getUnmappedApplications(req, res, next) {
  try {
    const legacyService = require('../services/legacy-migration.service');
    const apps = await legacyService.getUnmappedApplications();
    return ApiResponse.success(
      res,
      `${apps.length} unmapped application(s) found.`,
      apps,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Admin-initiated programme assignment for a specific application.
 */
async function assignProgramme(req, res, next) {
  try {
    const legacyService = require('../services/legacy-migration.service');
    const result = await legacyService.adminAssignProgramme(
      req.params.id,
      req.body.programmeId,
      req.userId
    );
    return ApiResponse.success(
      res,
      `Application ${result.application.applicationId} assigned to ${result.programme.programmeName}.`,
      result,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Trigger bulk legacy application migration.
 */
async function migrateLegacyApplications(req, res, next) {
  try {
    const legacyService = require('../services/legacy-migration.service');
    const result = await legacyService.migrateLegacyApplications();
    return ApiResponse.success(
      res,
      `Migration complete: ${result.mapped} mapped, ${result.skipped} skipped.`,
      result,
      200
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  getUsers,
  updateUserRole,
  createReviewer,
  getUnmappedApplications,
  assignProgramme,
  migrateLegacyApplications
};
