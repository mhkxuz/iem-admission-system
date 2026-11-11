const paymentService = require('../services/payment.service');
const ApiResponse = require('../utils/api-response');

/**
 * Applicant: Check admission confirmation and fee payment eligibility
 */
async function getEligibility(req, res, next) {
  try {
    const result = await paymentService.checkAdmissionEligibility(req.user._id);
    return ApiResponse.success(res, 'Admission confirmation eligibility retrieved.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Applicant: Initiate payment and create server-side payment order
 */
async function createOrder(req, res, next) {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
    const order = await paymentService.createPaymentOrder({
      applicantId: req.user._id,
      idempotencyKey
    });
    return ApiResponse.success(res, 'Payment order created successfully.', order, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Applicant: Verify payment signature and complete enrolment
 */
async function verifyPayment(req, res, next) {
  try {
    const { orderId, paymentId, signature } = req.body;
    const result = await paymentService.verifyPayment({
      orderId,
      paymentId,
      signature,
      applicantId: req.user._id
    });
    return ApiResponse.success(res, 'Payment verified and admission confirmed.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Gateway Webhook: Signature verification and asynchronous transaction updates
 */
async function handleWebhook(req, res, next) {
  try {
    const signatureHeader = req.headers['x-razorpay-signature'];
    const result = await paymentService.handleWebhook({
      payload: req.body,
      signatureHeader
    });
    return ApiResponse.success(res, 'Webhook event processed successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Applicant: Retrieve confirmed admission receipt & permanent enrolment details
 */
async function getAdmissionReceipt(req, res, next) {
  try {
    const receipt = await paymentService.getApplicantAdmissionReceipt(req.user._id);
    return ApiResponse.success(res, 'Admission receipt retrieved successfully.', receipt, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: List all payment transactions
 */
async function getAllPayments(req, res, next) {
  try {
    const result = await paymentService.getAllPayments(req.query);
    return ApiResponse.success(res, 'Payment transactions retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Retrieve payment details with audit history
 */
async function getPaymentById(req, res, next) {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    return ApiResponse.success(res, 'Payment details retrieved successfully.', payment, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Reconcile / manually override payment status
 */
async function reconcilePayment(req, res, next) {
  try {
    const { action, remarks } = req.body;
    const result = await paymentService.reconcilePayment({
      paymentId: req.params.id,
      adminId: req.user._id,
      action,
      remarks
    });
    return ApiResponse.success(res, 'Payment reconciled successfully.', result.payment || result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: List permanent enrolments
 */
async function getAllEnrolments(req, res, next) {
  try {
    const result = await paymentService.getAllEnrolments(req.query);
    return ApiResponse.success(res, 'Enrolment directory retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Get admission & fee collection statistics
 */
async function getStatistics(req, res, next) {
  try {
    const stats = await paymentService.getEnrolmentStatistics(req.query);
    return ApiResponse.success(res, 'Admission statistics retrieved successfully.', stats, 200);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEligibility,
  createOrder,
  verifyPayment,
  handleWebhook,
  getAdmissionReceipt,
  getAllPayments,
  getPaymentById,
  reconcilePayment,
  getAllEnrolments,
  getStatistics
};
