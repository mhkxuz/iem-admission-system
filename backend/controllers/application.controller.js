const applicationService = require('../services/application.service');
const ApiResponse = require('../utils/api-response');

/**
 * Handle admission application submission
 */
async function submit(req, res, next) {
  try {
    const application = await applicationService.submitApplication(
      req.userId,
      req.sanitizedApplication
    );

    return ApiResponse.success(
      res,
      'Your admission application has been submitted successfully.',
      application,
      201
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve current logged-in applicant's application for dashboard
 */
async function getMyApplication(req, res, next) {
  try {
    const application = await applicationService.getMyApplication(req.userId);
    return ApiResponse.success(
      res,
      application ? 'Application retrieved successfully.' : 'No application submitted yet.',
      application,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve specific application by ID (applicant ownership check or admin access)
 */
async function getById(req, res, next) {
  try {
    const application = await applicationService.getApplicationById(
      req.params.id,
      req.user
    );

    return ApiResponse.success(
      res,
      'Application details retrieved successfully.',
      application,
      200
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submit,
  getMyApplication,
  getById
};
