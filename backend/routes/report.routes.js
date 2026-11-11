const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');

// Strict administrative RBAC: Authentication + Admin role required on all routes
router.use(authenticate, requireAdmin);

// Analytical Reporting Endpoints
router.get('/overview', reportController.getOverview);
router.get('/applications', reportController.getApplications);
router.get('/documents', reportController.getDocuments);
router.get('/merit', reportController.getMerit);
router.get('/payments', reportController.getPayments);

// Export Endpoints (CSV and PDF)
router.get('/export/:type', reportController.exportReport);

module.exports = router;
