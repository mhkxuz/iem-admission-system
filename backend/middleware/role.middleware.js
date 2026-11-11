const AppError = require('../utils/app-error');

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Rejects requests if authenticated user does not have required role.
 *
 * @param  {...string} allowedRoles Roles permitted to access the endpoint
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required prior to role verification.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Access denied. This resource requires one of [${allowedRoles.join(', ')}] role(s), but your role is '${req.user.role}'.`,
          403
        )
      );
    }

    next();
  };
}

module.exports = {
  requireRole,
  requireAdmin: requireRole('admin'),
  requireApplicant: requireRole('applicant'),
  requireReviewer: requireRole('reviewer'),
  requireReviewerOrAdmin: requireRole('reviewer', 'admin')
};
