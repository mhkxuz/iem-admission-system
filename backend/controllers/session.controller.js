const sessionService = require('../services/session.service');
const ApiResponse = require('../utils/api-response');

/**
 * Handle admission session creation.
 */
async function createSession(req, res, next) {
  try {
    const session = await sessionService.createSession(req.body);
    return ApiResponse.success(res, 'Admission session created successfully.', session, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle listing of all admission sessions.
 */
async function getAllSessions(req, res, next) {
  try {
    const sessions = await sessionService.getAllSessions(req.query);
    return ApiResponse.success(res, 'Admission sessions retrieved successfully.', sessions, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle retrieval of a specific admission session by ID.
 */
async function getSessionById(req, res, next) {
  try {
    const session = await sessionService.getSessionById(req.params.id);
    return ApiResponse.success(res, 'Admission session retrieved successfully.', session, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle session update.
 */
async function updateSession(req, res, next) {
  try {
    const session = await sessionService.updateSession(req.params.id, req.body);
    return ApiResponse.success(res, 'Admission session updated successfully.', session, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle session activation.
 */
async function activateSession(req, res, next) {
  try {
    const session = await sessionService.activateSession(req.params.id);
    return ApiResponse.success(res, `Admission session '${session.sessionName}' activated successfully.`, session, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle session closing.
 */
async function closeSession(req, res, next) {
  try {
    const session = await sessionService.closeSession(req.params.id);
    return ApiResponse.success(res, `Admission session '${session.sessionName}' closed successfully.`, session, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Publicly retrieve the active admission session.
 */
async function getActiveSession(req, res, next) {
  try {
    const session = await sessionService.getActiveSession();
    if (!session) {
      return ApiResponse.success(res, 'No active admission session currently available.', null, 200);
    }
    return ApiResponse.success(res, 'Active admission session retrieved successfully.', session, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Delete a session if no applications or programmes reference it.
 */
async function deleteSession(req, res, next) {
  try {
    const session = await sessionService.deleteSession(req.params.id);
    return ApiResponse.success(
      res,
      `Academic session '${session.sessionName}' deleted successfully.`,
      session,
      200
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createSession,
  getAllSessions,
  getSessionById,
  updateSession,
  activateSession,
  closeSession,
  deleteSession,
  getActiveSession
};
