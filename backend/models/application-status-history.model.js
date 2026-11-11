const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required'],
      index: true
    },
    previousStatus: {
      type: String,
      enum: {
        values: ['Submitted', 'Under Review', 'Selected', 'Rejected'],
        message: '{VALUE} is not a valid status'
      },
      required: [true, 'Previous status is required']
    },
    newStatus: {
      type: String,
      enum: {
        values: ['Submitted', 'Under Review', 'Selected', 'Rejected'],
        message: '{VALUE} is not a valid status'
      },
      required: [true, 'New status is required']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const ApplicationStatusHistory = mongoose.model(
  'ApplicationStatusHistory',
  statusHistorySchema
);

module.exports = ApplicationStatusHistory;
