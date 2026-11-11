const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireApplicant, requireReviewerOrAdmin } = require('../middleware/role.middleware');
const { handleDocumentUpload } = require('../middleware/upload.middleware');

// All document routes require authentication
router.use(authenticate);

// Document upload (applicant-only)
router.post(
  '/upload',
  requireApplicant,
  handleDocumentUpload('document'),
  documentController.upload
);

// Reviewer/Admin inspection queue
router.get('/queue', requireReviewerOrAdmin, documentController.getReviewQueue);
router.get('/pending', requireReviewerOrAdmin, documentController.getReviewQueue);

// List documents for application (applicant owner, reviewer, or admin)
router.get('/application/:applicationId', documentController.getByApplication);

// Verification endpoint (reviewer or admin only)
router.patch('/:id/verify', requireReviewerOrAdmin, documentController.verifyDocument);

// Verification audit trail history
router.get('/:id/history', documentController.getVerificationHistory);

// View document inline (applicant owner, reviewer, or admin)
router.get('/:id/view', documentController.viewDocument);

// Download document as attachment (applicant owner, reviewer, or admin)
router.get('/:id/download', documentController.downloadDocument);

module.exports = router;
