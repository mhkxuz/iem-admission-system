const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  User,
  Application,
  UploadedDocument,
  AcademicSession,
  Programme,
  FeeStructure,
  SeatAllocation,
  Payment,
  Enrolment
} = require('../models');
const notificationService = require('./notification.service');
const config = require('../config/config');
const AppError = require('../utils/app-error');

/**
 * 1. Checks whether an applicant is eligible to confirm admission and pay the admission fee.
 */
async function checkAdmissionEligibility(applicantId) {
  if (!mongoose.Types.ObjectId.isValid(applicantId)) {
    throw new AppError('Invalid applicant ID format.', 400);
  }

  // A. Find applicant's application
  const application = await Application.findOne({ applicant: applicantId }).populate(
    'selectedProgramme'
  );
  if (!application) {
    return {
      isEligible: false,
      reason: 'No admission application found for this applicant.'
    };
  }

  const programme = application.selectedProgramme;
  if (!programme) {
    return {
      isEligible: false,
      reason: 'No academic programme is associated with this application.'
    };
  }

  const academicSessionName = application.academicSession;

  // B. Check if applicant is already enrolled
  const existingEnrolment = await Enrolment.findOne({ application: application._id }).populate(
    'payment'
  );
  if (existingEnrolment) {
    return {
      isEligible: false,
      isAlreadyEnrolled: true,
      enrolmentNumber: existingEnrolment.enrolmentNumber,
      enrolmentId: existingEnrolment._id,
      confirmedAt: existingEnrolment.confirmedAt,
      reason: 'Admission has already been confirmed and an enrolment number has been issued.'
    };
  }

  // C. Check published seat allocation
  const publishedAllocation = await SeatAllocation.findOne({
    programme: programme._id,
    academicSession: academicSessionName,
    status: 'Published'
  });

  if (!publishedAllocation) {
    return {
      isEligible: false,
      reason: 'Seat allocation has not been published yet for this programme and session.'
    };
  }

  const allocItem = publishedAllocation.allocations.find(
    (a) => a.application.toString() === application._id.toString()
  );

  if (!allocItem) {
    return {
      isEligible: false,
      reason: 'Application is not listed in the published seat allocation.'
    };
  }

  if (allocItem.allocationStatus !== 'Allocated') {
    return {
      isEligible: false,
      allocationStatus: allocItem.allocationStatus,
      reason: `Admission cannot be confirmed because your allocation status is '${allocItem.allocationStatus}' (not 'Allocated').`
    };
  }

  // D. Document Verification Criteria
  const uploadedDocs = await UploadedDocument.find({ application: application._id });
  const hasRejectedDocs = uploadedDocs.some((d) => d.verificationStatus === 'Rejected');
  if (hasRejectedDocs) {
    return {
      isEligible: false,
      documentPending: true,
      reason: 'One or more required documents were rejected during verification. Please re-upload verified documents.'
    };
  }

  // Mandatory marksheets must be Verified
  const mandatoryTypes = ['Class 10 Marksheet', 'Class 12 Marksheet'];
  for (const docType of mandatoryTypes) {
    const doc = uploadedDocs.find((d) => d.documentType === docType);
    if (!doc || doc.verificationStatus !== 'Verified') {
      return {
        isEligible: false,
        documentPending: true,
        reason: `Document verification requirement unmet: '${docType}' must be verified by admissions prior to confirmation.`
      };
    }
  }

  // E. Resolve Active Fee Structure
  const sessionDoc = await AcademicSession.findOne({ sessionName: academicSessionName });
  if (!sessionDoc) {
    return {
      isEligible: false,
      reason: `Academic session '${academicSessionName}' is not recognized.`
    };
  }

  const feeStructure = await FeeStructure.findOne({
    programme: programme._id,
    academicSession: sessionDoc._id,
    isActive: true
  });

  if (!feeStructure) {
    return {
      isEligible: false,
      reason: 'No active fee structure is configured for this programme and academic session.'
    };
  }

  const admissionFee = Number(feeStructure.admissionFee) || 0;
  if (admissionFee <= 0) {
    return {
      isEligible: false,
      reason: 'Admission fee amount is not configured in the active fee structure.'
    };
  }

  return {
    isEligible: true,
    application: {
      _id: application._id,
      applicationId: application.applicationId
    },
    programme: {
      _id: programme._id,
      programmeName: programme.programmeName,
      programmeCode: programme.programmeCode,
      degree: programme.degree,
      department: programme.department
    },
    academicSession: academicSessionName,
    allocation: {
      allocatedCategory: allocItem.allocatedCategory,
      seatNumber: allocItem.seatNumber,
      meritRank: allocItem.meritRank
    },
    feeStructure: {
      _id: feeStructure._id,
      admissionFee,
      currency: feeStructure.currency || 'INR',
      totalProgrammeFee: feeStructure.totalProgrammeFee,
      paymentInstructions: feeStructure.paymentInstructions
    }
  };
}

/**
 * 2. Creates a server-side payment order.
 */
async function createPaymentOrder({ applicantId, idempotencyKey }) {
  const eligibility = await checkAdmissionEligibility(applicantId);
  if (!eligibility.isEligible) {
    throw new AppError(eligibility.reason || 'Not eligible for admission confirmation.', 400);
  }

  // Check for existing payment with matching idempotencyKey
  if (idempotencyKey) {
    const existingByIdempotency = await Payment.findOne({ idempotencyKey });
    if (existingByIdempotency) {
      if (existingByIdempotency.status === 'Successful') {
        const enrolment = await Enrolment.findOne({ payment: existingByIdempotency._id });
        return {
          orderId: existingByIdempotency.orderId,
          amount: existingByIdempotency.amount,
          currency: existingByIdempotency.currency,
          status: 'Successful',
          isAlreadyPaid: true,
          enrolmentNumber: enrolment?.enrolmentNumber
        };
      }
      return {
        orderId: existingByIdempotency.orderId,
        amount: existingByIdempotency.amount,
        currency: existingByIdempotency.currency,
        keyId: config.razorpayKeyId || 'rzp_test_sandbox_key',
        isSandbox: !config.razorpayKeyId,
        status: existingByIdempotency.status
      };
    }
  }

  const amount = eligibility.feeStructure.admissionFee;
  const currency = eligibility.feeStructure.currency || 'INR';

  // Generate unique Order ID
  const isSandbox = !config.razorpayKeyId || config.nodeEnv === 'test';
  let orderId;
  let gatewayMetadata = {};

  if (!isSandbox) {
    try {
      // In live environment, integrate with Razorpay / Gateway API
      const Razorpay = require('razorpay');
      const rzp = new Razorpay({
        key_id: config.razorpayKeyId,
        key_secret: config.razorpayKeySecret
      });
      const order = await rzp.orders.create({
        amount: Math.round(amount * 100), // amount in paise
        currency,
        receipt: `rcpt_${eligibility.application.applicationId}`
      });
      orderId = order.id;
      gatewayMetadata = order;
    } catch (err) {
      throw new AppError(`Payment Gateway Error: ${err.message}`, 502);
    }
  } else {
    // Deterministic, secure Sandbox Order Identifier
    orderId = `order_iem_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    gatewayMetadata = { mode: 'sandbox', created_at: new Date() };
  }

  const payment = await Payment.create({
    applicant: applicantId,
    application: eligibility.application._id,
    programme: eligibility.programme._id,
    academicSession: eligibility.academicSession,
    feeStructure: eligibility.feeStructure._id,
    amount,
    currency,
    feeSnapshot: {
      admissionFee: amount,
      totalProgrammeFee: eligibility.feeStructure.totalProgrammeFee,
      currency,
      feeStructureId: eligibility.feeStructure._id,
      description: `Admission Confirmation Fee for ${eligibility.programme.programmeName}`
    },
    orderId,
    gateway: isSandbox ? 'sandbox' : 'razorpay',
    gatewayResponse: gatewayMetadata,
    status: 'Initiated',
    idempotencyKey: idempotencyKey || undefined,
    auditHistory: [
      {
        action: 'OrderCreated',
        timestamp: new Date(),
        details: `Payment order initiated for ₹${amount} (${orderId})`,
        source: 'Applicant'
      }
    ]
  });

  // Emit Transactional Notification
  await notificationService.sendNotification({
    recipient: applicantId,
    type: 'Payment_Initiated',
    title: 'Admission Fee Payment Initiated',
    message: `Payment order of ${currency} ${amount} initiated for ${eligibility.programme.programmeName}. Order ID: ${orderId}`,
    metadata: { orderId, amount, currency }
  });

  return {
    orderId,
    amount,
    currency,
    keyId: config.razorpayKeyId || 'rzp_test_sandbox_key',
    isSandbox,
    programmeName: eligibility.programme.programmeName,
    allocatedCategory: eligibility.allocation.allocatedCategory
  };
}

/**
 * 3. Verifies payment signature and atomically creates permanent Enrolment.
 */
async function verifyPayment({ orderId, paymentId, signature, applicantId }) {
  if (!orderId || !paymentId) {
    throw new AppError('orderId and paymentId are required for payment verification.', 400);
  }

  const payment = await Payment.findOne({ orderId });
  if (!payment) {
    throw new AppError('Payment order not found.', 404);
  }

  if (applicantId && payment.applicant.toString() !== applicantId.toString()) {
    throw new AppError('Unauthorized: You can only verify your own payment transactions.', 403);
  }

  // Idempotency: If already Successful, return confirmed enrolment
  if (payment.status === 'Successful') {
    const existingEnrolment = await Enrolment.findOne({ payment: payment._id }).populate(
      'programme',
      'programmeName programmeCode degree department'
    );
    return {
      status: 'Successful',
      isDuplicate: true,
      enrolment: existingEnrolment,
      payment
    };
  }

  const isSandbox = payment.gateway === 'sandbox' || !config.razorpayKeySecret;

  // Signature verification logic
  if (!isSandbox) {
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      payment.status = 'Failed';
      payment.failureReason = 'Invalid cryptographic signature from gateway.';
      payment.auditHistory.push({
        action: 'SignatureVerificationFailed',
        timestamp: new Date(),
        details: 'Payment signature mismatch.',
        source: 'GatewayWebhook'
      });
      await payment.save();

      await notificationService.sendNotification({
        recipient: payment.applicant,
        type: 'Payment_Failed',
        title: 'Payment Verification Failed',
        message: `Your payment verification failed due to invalid transaction credentials. Order: ${orderId}`,
        metadata: { orderId, paymentId }
      });

      throw new AppError('Invalid payment signature verification failed.', 400);
    }
  } else {
    // Sandbox verification check
    const expectedSandboxSig = crypto
      .createHash('sha256')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (
      signature &&
      signature !== 'sandbox_valid_sig' &&
      signature !== expectedSandboxSig
    ) {
      payment.status = 'Failed';
      payment.failureReason = 'Sandbox payment verification failed: signature mismatch.';
      payment.auditHistory.push({
        action: 'SignatureVerificationFailed',
        timestamp: new Date(),
        details: 'Sandbox cryptographic signature mismatch.',
        source: 'Applicant'
      });
      await payment.save();
      throw new AppError('Invalid payment signature verification failed.', 400);
    }
  }

  // Atomic state update: Successful
  payment.paymentId = paymentId;
  payment.signature = signature;
  payment.status = 'Successful';
  payment.paidAt = new Date();
  payment.auditHistory.push({
    action: 'PaymentVerified',
    timestamp: new Date(),
    details: `Payment verified successfully (ID: ${paymentId})`,
    source: 'Applicant'
  });
  await payment.save();

  // Generate Unique Permanent Enrolment Number: ENR-YYYY-XXXXX
  const year = payment.academicSession.split('-')[0] || new Date().getFullYear();
  const enrolmentCount = await Enrolment.countDocuments({ academicSession: payment.academicSession });
  const enrolmentNumber = `ENR-${year}-${String(enrolmentCount + 1).padStart(5, '0')}`;

  // Retrieve allocation details from published seat allocation
  const publishedAllocation = await SeatAllocation.findOne({
    programme: payment.programme,
    academicSession: payment.academicSession,
    status: 'Published'
  });

  const allocItem = publishedAllocation?.allocations?.find(
    (a) => a.application.toString() === payment.application.toString()
  );

  const application = await Application.findById(payment.application);

  // Create Enrolment Record (Guarded against duplicate creation)
  let enrolment;
  try {
    enrolment = await Enrolment.create({
      enrolmentNumber,
      applicant: payment.applicant,
      application: payment.application,
      applicationId: application?.applicationId || `IEM-${year}-${String(enrolmentCount + 1).padStart(5, '0')}`,
      programme: payment.programme,
      academicSession: payment.academicSession,
      allocatedCategory: allocItem?.allocatedCategory || 'General',
      seatNumber: allocItem?.seatNumber || null,
      payment: payment._id,
      paymentReference: paymentId,
      feeAmountPaid: payment.amount,
      currency: payment.currency,
      enrolmentStatus: 'Confirmed',
      confirmedAt: new Date(),
      confirmedBy: applicantId,
      remarks: 'Admission confirmed following verified payment.',
      auditTrail: [
        {
          action: 'EnrolmentGenerated',
          performedBy: applicantId,
          timestamp: new Date(),
          remarks: `Enrolment number ${enrolmentNumber} issued upon payment ${paymentId}`
        }
      ]
    });
  } catch (err) {
    if (err.code === 11000) {
      // Concurrency protection: already created
      enrolment = await Enrolment.findOne({ application: payment.application });
    } else {
      throw err;
    }
  }

  // Transactional Notifications
  await notificationService.sendNotification({
    recipient: payment.applicant,
    type: 'Payment_Successful',
    title: 'Payment Successful',
    message: `Payment of ${payment.currency} ${payment.amount} for Order ${orderId} has been confirmed.`,
    metadata: { orderId, paymentId, amount: payment.amount }
  });

  await notificationService.sendNotification({
    recipient: payment.applicant,
    type: 'Admission_Confirmed',
    title: 'Admission Confirmed & Enrolment Issued',
    message: `Congratulations! Your admission is confirmed. Permanent Enrolment Number: ${enrolment.enrolmentNumber}`,
    metadata: { enrolmentNumber: enrolment.enrolmentNumber, applicationId: enrolment.applicationId }
  });

  return {
    status: 'Successful',
    enrolment,
    payment
  };
}

/**
 * 4. Webhook processing endpoint (Idempotent & Authenticated).
 */
async function handleWebhook({ payload, signatureHeader }) {
  if (config.razorpayWebhookSecret) {
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpayWebhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSignature !== signatureHeader) {
      throw new AppError('Invalid webhook cryptographic signature.', 400);
    }
  }

  const event = payload?.event;
  const paymentEntity = payload?.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id || payload?.order_id;
  const paymentId = paymentEntity?.id || payload?.payment_id;

  if (!orderId) {
    return { status: 'ignored', reason: 'No order_id present in webhook payload' };
  }

  const payment = await Payment.findOne({ orderId });
  if (!payment) {
    return { status: 'ignored', reason: 'Order not found in database' };
  }

  if (payment.status === 'Successful') {
    return { status: 'already_processed', message: 'Payment was already verified successfully.' };
  }

  if (event === 'payment.captured' || event === 'order.paid' || payload?.status === 'captured') {
    return await verifyPayment({
      orderId,
      paymentId: paymentId || `pay_wh_${Date.now()}`,
      signature: signatureHeader || 'webhook_verified',
      applicantId: payment.applicant
    });
  } else if (event === 'payment.failed' || payload?.status === 'failed') {
    payment.status = 'Failed';
    payment.failureReason =
      paymentEntity?.error_description ||
      payload?.error_description ||
      'Payment failed at gateway.';
    payment.auditHistory.push({
      action: 'WebhookPaymentFailed',
      timestamp: new Date(),
      details: payment.failureReason,
      source: 'GatewayWebhook'
    });
    await payment.save();

    await notificationService.sendNotification({
      recipient: payment.applicant,
      type: 'Payment_Failed',
      title: 'Payment Transaction Failed',
      message: `Your payment attempt for Order ${orderId} failed: ${payment.failureReason}`,
      metadata: { orderId, reason: payment.failureReason }
    });

    return { status: 'failed_recorded', paymentId };
  }

  return { status: 'unhandled_event', event };
}

/**
 * 5. Retrieve caller applicant's admission confirmation receipt and permanent enrolment details.
 */
async function getApplicantAdmissionReceipt(applicantId) {
  const enrolment = await Enrolment.findOne({ applicant: applicantId })
    .populate('programme', 'programmeName programmeCode degree department duration durationUnit')
    .populate('payment')
    .populate('application');

  if (!enrolment) {
    // Return eligibility status for admission confirmation
    const eligibility = await checkAdmissionEligibility(applicantId);
    return {
      hasConfirmedAdmission: false,
      eligibility
    };
  }

  return {
    hasConfirmedAdmission: true,
    enrolmentNumber: enrolment.enrolmentNumber,
    applicationId: enrolment.applicationId,
    programme: enrolment.programme,
    academicSession: enrolment.academicSession,
    allocatedCategory: enrolment.allocatedCategory,
    seatNumber: enrolment.seatNumber,
    feeAmountPaid: enrolment.feeAmountPaid,
    currency: enrolment.currency,
    confirmedAt: enrolment.confirmedAt,
    paymentReference: enrolment.paymentReference,
    enrolmentStatus: enrolment.enrolmentStatus,
    payment: {
      orderId: enrolment.payment?.orderId,
      paidAt: enrolment.payment?.paidAt,
      paymentMethod: enrolment.payment?.paymentMethod
    }
  };
}

/**
 * 6. Admin: List all payments with filtering, searching, and pagination.
 */
async function getAllPayments({
  page = 1,
  limit = 10,
  status,
  programmeId,
  academicSession,
  search
} = {}) {
  const query = {};
  if (status) query.status = status;
  if (programmeId) query.programme = programmeId;
  if (academicSession) query.academicSession = academicSession;

  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ orderId: searchRegex }, { paymentId: searchRegex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('applicant', 'fullName email phone')
      .populate('programme', 'programmeName programmeCode')
      .populate('application', 'applicationId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Payment.countDocuments(query)
  ]);

  return {
    payments,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
}

/**
 * 7. Admin: Retrieve a single payment detail with full audit history.
 */
async function getPaymentById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid payment ID format.', 400);
  }

  const payment = await Payment.findById(id)
    .populate('applicant', 'fullName email phone')
    .populate('programme', 'programmeName programmeCode department degree')
    .populate('application', 'applicationId')
    .populate('feeStructure');

  if (!payment) {
    throw new AppError('Payment record not found.', 404);
  }

  return payment;
}

/**
 * 8. Admin: Reconcile / manually override payment status with mandatory remarks.
 */
async function reconcilePayment({ paymentId, adminId, action, remarks }) {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new AppError('Invalid payment ID format.', 400);
  }
  if (!remarks || !remarks.trim()) {
    throw new AppError('Administrative remarks are strictly required for reconciliation.', 400);
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new AppError('Payment not found.', 404);
  }

  const normalizedAction = (action || '').replace(/_/g, '').toLowerCase();

  if (normalizedAction === 'marksuccessful') {
    if (payment.status === 'Successful') {
      throw new AppError('Payment is already marked as Successful.', 400);
    }

    const verificationResult = await verifyPayment({
      orderId: payment.orderId,
      paymentId: payment.paymentId || `pay_reconciled_${Date.now()}`,
      signature: 'admin_reconciliation_authorized',
      applicantId: payment.applicant
    });

    payment.auditHistory.push({
      action: 'AdminReconciliationSuccessful',
      timestamp: new Date(),
      details: remarks.trim(),
      source: 'AdminReconciliation'
    });
    await payment.save();

    return verificationResult;
  } else if (normalizedAction === 'markfailed' || normalizedAction === 'cancel') {
    payment.status = normalizedAction === 'cancel' ? 'Cancelled' : 'Failed';
    payment.failureReason = remarks.trim();
    payment.auditHistory.push({
      action: `AdminReconciliation_${payment.status}`,
      timestamp: new Date(),
      details: `Status set to ${payment.status}: ${remarks.trim()}`,
      source: 'AdminReconciliation'
    });
    await payment.save();
    return { payment };
  }

  throw new AppError("Invalid reconciliation action. Allowed: 'MarkSuccessful', 'MarkFailed', 'Cancel'", 400);
}

/**
 * 9. Admin: List all permanent enrolments with search and filters.
 */
async function getAllEnrolments({
  page = 1,
  limit = 10,
  programmeId,
  academicSession,
  search
} = {}) {
  const query = {};
  if (programmeId) query.programme = programmeId;
  if (academicSession) query.academicSession = academicSession;

  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { enrolmentNumber: searchRegex },
      { applicationId: searchRegex },
      { paymentReference: searchRegex }
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [enrolments, total] = await Promise.all([
    Enrolment.find(query)
      .populate('applicant', 'fullName email phone')
      .populate('programme', 'programmeName programmeCode degree department')
      .populate('application', 'applicationId')
      .populate('payment', 'orderId paymentId amount currency paidAt')
      .sort({ confirmedAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Enrolment.countDocuments(query)
  ]);

  return {
    enrolments,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
}

/**
 * 10. Admin: Enrolment and fee collection analytics.
 */
async function getEnrolmentStatistics({ academicSession } = {}) {
  const match = {};
  if (academicSession) match.academicSession = academicSession;

  const totalEnrolled = await Enrolment.countDocuments(match);
  const totalPaymentsSuccessful = await Payment.countDocuments({ ...match, status: 'Successful' });
  const totalPaymentsPending = await Payment.countDocuments({
    ...match,
    status: { $in: ['Initiated', 'Pending'] }
  });
  const totalPaymentsFailed = await Payment.countDocuments({ ...match, status: 'Failed' });

  // Fee collection total
  const feeAggregation = await Payment.aggregate([
    { $match: { ...match, status: 'Successful' } },
    { $group: { _id: null, totalCollected: { $sum: '$amount' } } }
  ]);
  const totalFeesCollected = feeAggregation[0]?.totalCollected || 0;

  // Programme-wise Enrolment Breakdown
  const byProgramme = await Enrolment.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$programme',
        enrolledCount: { $sum: 1 },
        feeCollected: { $sum: '$feeAmountPaid' }
      }
    },
    {
      $lookup: {
        from: 'programmes',
        localField: '_id',
        foreignField: '_id',
        as: 'programmeInfo'
      }
    },
    {
      $project: {
        programmeId: '$_id',
        programmeName: { $arrayElemAt: ['$programmeInfo.programmeName', 0] },
        programmeCode: { $arrayElemAt: ['$programmeInfo.programmeCode', 0] },
        enrolledCount: 1,
        feeCollected: 1
      }
    }
  ]);

  return {
    totalEnrolled,
    totalEnrolments: totalEnrolled,
    totalPaymentsSuccessful,
    totalPaymentsPending,
    totalPaymentsFailed,
    totalFeesCollected,
    totalFeeCollected: totalFeesCollected,
    byProgramme
  };
}

module.exports = {
  checkAdmissionEligibility,
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getApplicantAdmissionReceipt,
  getAllPayments,
  getPaymentById,
  reconcilePayment,
  getAllEnrolments,
  getEnrolmentStatistics
};
