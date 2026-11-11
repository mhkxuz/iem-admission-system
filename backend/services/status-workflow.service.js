const AppError = require('../utils/app-error');

/**
 * Centralized application status workflow.
 *
 * The admission process follows a strict state machine:
 *
 *   Submitted -> Under Review -> Selected
 *                              -> Rejected
 *
 * Selected and Rejected are terminal states. All transition rules live in this
 * single module so controllers and other services never duplicate them.
 */
const APPLICATION_STATUSES = ['Submitted', 'Under Review', 'Selected', 'Rejected'];

const STATUS_TRANSITIONS = Object.freeze({
  Submitted: Object.freeze(['Under Review']),
  'Under Review': Object.freeze(['Selected', 'Rejected']),
  Selected: Object.freeze([]),
  Rejected: Object.freeze([])
});

/**
 * Check whether a value is one of the supported application statuses.
 */
function isValidStatus(status) {
  return typeof status === 'string' && APPLICATION_STATUSES.includes(status);
}

/**
 * Return the statuses an application may move to from its current status.
 */
function getAllowedNextStatuses(currentStatus) {
  if (!isValidStatus(currentStatus)) {
    return [];
  }
  return [...STATUS_TRANSITIONS[currentStatus]];
}

/**
 * Validate a requested status transition.
 * Throws a 400 AppError for unknown statuses or transitions that are not part
 * of the workflow. Returns true when the transition is permitted.
 */
function validateStatusTransition(currentStatus, requestedStatus) {
  if (!isValidStatus(requestedStatus)) {
    throw new AppError(
      `Invalid status '${requestedStatus}'. Permitted statuses are: ${APPLICATION_STATUSES.join(', ')}.`,
      400
    );
  }

  if (!isValidStatus(currentStatus)) {
    throw new AppError(
      `The application has an unrecognised current status '${currentStatus}'.`,
      400
    );
  }

  const allowedNextStatuses = STATUS_TRANSITIONS[currentStatus];

  if (!allowedNextStatuses.includes(requestedStatus)) {
    if (allowedNextStatuses.length === 0) {
      throw new AppError(
        `Invalid status transition from '${currentStatus}' to '${requestedStatus}'. '${currentStatus}' is a terminal status and cannot be changed.`,
        400
      );
    }

    throw new AppError(
      `Invalid status transition from '${currentStatus}' to '${requestedStatus}'. Allowed next status(es): ${allowedNextStatuses.join(', ')}.`,
      400
    );
  }

  return true;
}

module.exports = {
  APPLICATION_STATUSES,
  STATUS_TRANSITIONS,
  isValidStatus,
  getAllowedNextStatuses,
  validateStatusTransition
};
