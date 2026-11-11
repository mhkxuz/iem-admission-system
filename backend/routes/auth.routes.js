const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../validators/auth.validator');
const authenticate = require('../middleware/auth.middleware');
const { requireAdmin, requireApplicant } = require('../middleware/role.middleware');
const ApiResponse = require('../utils/api-response');

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);

// Protected routes (any authenticated user)
router.get('/me', authenticate, authController.getMe);

// Protected RBAC test routes
router.get('/test-admin', authenticate, requireAdmin, (req, res) => {
  return ApiResponse.success(res, 'Admin authorization verified.', { role: req.user.role });
});

router.get('/test-applicant', authenticate, requireApplicant, (req, res) => {
  return ApiResponse.success(res, 'Applicant authorization verified.', { role: req.user.role });
});

module.exports = router;
