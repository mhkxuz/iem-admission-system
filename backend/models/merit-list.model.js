const mongoose = require('mongoose');

const meritListEntrySchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required']
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant reference is required']
    },
    applicationId: {
      type: String,
      required: [true, 'Application ID is required'],
      trim: true
    },
    candidateName: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      enum: ['General', 'OBC', 'SC', 'ST', 'EWS', 'Management'],
      required: [true, 'Admission category is required']
    },
    class12Percentage: {
      type: Number,
      required: true
    },
    rawEntranceScore: {
      type: String,
      trim: true,
      default: ''
    },
    normalizedEntranceScore: {
      type: Number,
      default: 0
    },
    compositeScore: {
      type: Number,
      required: true,
      index: true
    },
    meritRank: {
      type: Number,
      default: 0,
      index: true
    },
    categoryRank: {
      type: Number,
      default: 0
    },
    eligibilityStatus: {
      type: String,
      enum: ['Eligible', 'Eligible (Pending Documents)', 'Ineligible'],
      default: 'Eligible',
      index: true
    },
    eligibilityRemarks: {
      type: String,
      trim: true,
      default: ''
    },
    documentStatus: {
      type: String,
      trim: true,
      default: 'Pending Verification'
    }
  },
  { _id: true }
);

const categoryCutoffSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    highestScore: { type: Number, default: 0 },
    lowestScore: { type: Number, default: 0 },
    totalApplicants: { type: Number, default: 0 },
    eligibleApplicants: { type: Number, default: 0 }
  },
  { _id: false }
);

const meritListSchema = new mongoose.Schema(
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
    meritConfiguration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MeritConfiguration'
    },
    configurationSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    version: {
      type: Number,
      default: 1
    },
    round: {
      type: Number,
      default: 1
    },
    roundLabel: {
      type: String,
      trim: true,
      default: 'Round 1'
    },
    status: {
      type: String,
      enum: {
        values: ['Draft', 'Published', 'Archived'],
        message: '{VALUE} is not a valid merit list status'
      },
      default: 'Draft',
      index: true
    },
    publishedAt: {
      type: Date,
      default: null
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    entries: {
      type: [meritListEntrySchema],
      default: []
    },
    cutoffs: {
      highestScore: { type: Number, default: 0 },
      lowestShortlistedScore: { type: Number, default: 0 },
      categoryCutoffs: { type: [categoryCutoffSchema], default: [] },
      totalEligible: { type: Number, default: 0 },
      totalIneligible: { type: Number, default: 0 },
      totalPendingDocs: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast lookup
meritListSchema.index({ programme: 1, academicSession: 1, status: 1 });

const MeritList = mongoose.model('MeritList', meritListSchema);

module.exports = MeritList;
