const mongoose = require('mongoose');

const allocationItemSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    applicationId: {
      type: String,
      required: true,
      trim: true
    },
    candidateName: {
      type: String,
      trim: true,
      default: ''
    },
    meritRank: {
      type: Number,
      required: true
    },
    categoryRank: {
      type: Number,
      default: 0
    },
    appliedCategory: {
      type: String,
      required: true
    },
    allocatedCategory: {
      type: String,
      default: ''
    },
    compositeScore: {
      type: Number,
      required: true
    },
    allocationStatus: {
      type: String,
      enum: {
        values: ['Allocated', 'Waitlisted', 'Ineligible'],
        message: '{VALUE} is not a valid allocation status'
      },
      required: true
    },
    allocationReason: {
      type: String,
      trim: true,
      default: ''
    },
    seatNumber: {
      type: Number,
      default: null
    }
  },
  { _id: true }
);

const categorySummarySchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    totalSeats: { type: Number, default: 0 },
    allocatedSeats: { type: Number, default: 0 },
    remainingSeats: { type: Number, default: 0 }
  },
  { _id: false }
);

const allocationAuditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['Generated', 'Approved', 'Published'],
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

const seatAllocationSchema = new mongoose.Schema(
  {
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
    meritList: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MeritList',
      required: [true, 'Merit list reference is required']
    },
    version: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: {
        values: ['Draft', 'Approved', 'Published', 'Archived'],
        message: '{VALUE} is not a valid allocation status'
      },
      default: 'Draft',
      index: true
    },
    totalSeats: {
      type: Number,
      default: 0
    },
    allocatedSeats: {
      type: Number,
      default: 0
    },
    remainingSeats: {
      type: Number,
      default: 0
    },
    unfilledSeatRule: {
      type: String,
      enum: ['Keep Vacant', 'Convert to General'],
      default: 'Keep Vacant'
    },
    categorySummary: {
      type: [categorySummarySchema],
      default: []
    },
    allocations: {
      type: [allocationItemSchema],
      default: []
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    publishedAt: {
      type: Date,
      default: null
    },
    history: {
      type: [allocationAuditEntrySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

seatAllocationSchema.index({ programme: 1, academicSession: 1, status: 1 });

const SeatAllocation = mongoose.model('SeatAllocation', seatAllocationSchema);

module.exports = SeatAllocation;
