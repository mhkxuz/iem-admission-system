const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireAdmin, requireApplicant } = require('../middleware/role.middleware');

// Public Webhook: Gateway asynchronous transaction callbacks
router.post('/webhook', paymentController.handleWebhook);

// Applicant endpoints: Check admission eligibility, initiate order, verify payment & retrieve receipt
router.get('/eligibility', authenticate, requireApplicant, paymentController.getEligibility);
router.post('/order', authenticate, requireApplicant, paymentController.createOrder);
router.post('/verify', authenticate, requireApplicant, paymentController.verifyPayment);
router.get('/receipt', authenticate, requireApplicant, paymentController.getAdmissionReceipt);

// Administrative endpoints: Strict RBAC (authenticate + requireAdmin)
router.get('/enrolments/all', authenticate, requireAdmin, paymentController.getAllEnrolments);
router.get('/enrolments/statistics', authenticate, requireAdmin, paymentController.getStatistics);
router.get('/', authenticate, requireAdmin, paymentController.getAllPayments);
router.get('/:id', authenticate, requireAdmin, paymentController.getPaymentById);
router.post('/:id/reconcile', authenticate, requireAdmin, paymentController.reconcilePayment);

module.exports = router;
