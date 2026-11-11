const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');
const { validateApplicationSubmission } = require('../validators/application.validator');
const authenticate = require('../middleware/auth.middleware');
const { requireApplicant } = require('../middleware/role.middleware');

// All application endpoints require valid JWT authentication
router.use(authenticate);

// Applicant-only submission
router.post(
  '/',
  requireApplicant,
  validateApplicationSubmission,
  applicationController.submit
);

// Applicant-only dashboard data retrieval
router.get(
  '/my-application',
  requireApplicant,
  applicationController.getMyApplication
);

// Individual application inspection (protected with applicant-ownership or admin check)
router.get(
  '/:id',
  applicationController.getById
);

module.exports = router;
