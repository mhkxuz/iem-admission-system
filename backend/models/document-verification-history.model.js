const mongoose = require('mongoose');

const documentVerificationHistorySchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadedDocument',
      required: [true, 'Document reference is required'],
      index: true
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      index: true
    },
    previousStatus: {
      type: String,
      enum: {
        values: ['Pending', 'Verified', 'Rejected'],
        message: '{VALUE} is not a valid verification status'
      },
      default: 'Pending',
      required: [true, 'Previous verification status is required']
    },
    newStatus: {
      type: String,
      enum: {
        values: ['Pending', 'Verified', 'Rejected'],
        message: '{VALUE} is not a valid verification status'
      },
      required: [true, 'New verification status is required']
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Verifier reference is required']
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const DocumentVerificationHistory = mongoose.model(
  'DocumentVerificationHistory',
  documentVerificationHistorySchema
);

module.exports = DocumentVerificationHistory;
