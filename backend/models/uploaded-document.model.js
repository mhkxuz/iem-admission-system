const mongoose = require('mongoose');

const uploadedDocumentSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required'],
      index: true
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant reference is required'],
      index: true
    },
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: [
          'Class 10 Marksheet',
          'Class 12 Marksheet',
          'Entrance Examination Scorecard',
          'Photograph',
          'Other Supporting Documents',
          'Other'
        ],
        message: '{VALUE} is not a valid document type'
      }
    },
    originalFileName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true
    },
    storedFileName: {
      type: String,
      required: [true, 'Stored file name is required'],
      trim: true
    },
    filePath: {
      type: String,
      required: [true, 'File path is required']
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required']
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [1, 'File size must be greater than 0']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    verificationStatus: {
      type: String,
      enum: {
        values: ['Pending', 'Verified', 'Rejected'],
        message: '{VALUE} is not a valid verification status'
      },
      default: 'Pending',
      index: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verificationRemarks: {
      type: String,
      trim: true,
      default: ''
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadedDocument',
      default: null
    }
  },
  {
    timestamps: true
  }
);

const UploadedDocument = mongoose.model('UploadedDocument', uploadedDocumentSchema);

module.exports = UploadedDocument;
