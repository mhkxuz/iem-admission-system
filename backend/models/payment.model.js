const mongoose = require('mongoose');

const paymentAuditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String,
      trim: true,
      default: ''
    },
    source: {
      type: String,
      enum: ['Applicant', 'GatewayWebhook', 'AdminReconciliation', 'System'],
      default: 'Applicant'
    }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant reference is required'],
      index: true
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required'],
      index: true
    },
    programme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Programme',
      required: [true, 'Programme reference is required'],
      index: true
    },
    academicSession: {
      type: String,
      required: [true, 'Academic session is required'],
      trim: true,
      index: true
    },
    feeStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeStructure',
      required: [true, 'Fee structure reference is required']
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Payment amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true
    },
    feeSnapshot: {
      admissionFee: { type: Number, default: 0 },
      totalProgrammeFee: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure' },
      description: { type: String, default: '' }
    },
    orderId: {
      type: String,
      required: [true, 'Gateway order ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    paymentId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },
    signature: {
      type: String,
      default: null,
      trim: true
    },
    paymentMethod: {
      type: String,
      default: 'Online',
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['Initiated', 'Pending', 'Successful', 'Failed', 'Cancelled'],
        message: '{VALUE} is not a valid payment status'
      },
      default: 'Initiated',
      index: true
    },
    gateway: {
      type: String,
      default: 'sandbox',
      trim: true
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    failureReason: {
      type: String,
      trim: true,
      default: ''
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
      trim: true
    },
    paidAt: {
      type: Date,
      default: null
    },
    auditHistory: {
      type: [paymentAuditEntrySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ applicant: 1, application: 1, status: 1 });
paymentSchema.index({ orderId: 1, status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
