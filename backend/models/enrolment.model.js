const mongoose = require('mongoose');

const enrolmentAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const enrolmentSchema = new mongoose.Schema(
  {
    enrolmentNumber: {
      type: String,
      required: [true, 'Enrolment number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
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
      unique: true,
      index: true
    },
    applicationId: {
      type: String,
      required: [true, 'Application ID is required'],
      trim: true,
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
    allocatedCategory: {
      type: String,
      required: [true, 'Allocated category is required'],
      trim: true
    },
    seatNumber: {
      type: Number,
      default: null
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: [true, 'Payment reference is required'],
      unique: true,
      index: true
    },
    paymentReference: {
      type: String,
      required: [true, 'Payment transaction reference is required'],
      trim: true
    },
    feeAmountPaid: {
      type: Number,
      required: [true, 'Fee amount paid is required'],
      min: [0, 'Fee amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true
    },
    enrolmentStatus: {
      type: String,
      enum: {
        values: ['Confirmed', 'Provisional', 'Cancelled'],
        message: '{VALUE} is not a valid enrolment status'
      },
      default: 'Confirmed',
      index: true
    },
    confirmedAt: {
      type: Date,
      default: Date.now
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    remarks: {
      type: String,
      trim: true,
      default: 'Admission confirmed following successful payment.'
    },
    auditTrail: {
      type: [enrolmentAuditSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

enrolmentSchema.index({ programme: 1, academicSession: 1 });

const Enrolment = mongoose.model('Enrolment', enrolmentSchema);

module.exports = Enrolment;
