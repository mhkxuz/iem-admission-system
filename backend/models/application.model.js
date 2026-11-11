const mongoose = require('mongoose');

const personalInfoSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    dob: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['Male', 'Female', 'Other']
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    pincode: {
      type: String,
      required: [true, 'PIN code is required'],
      trim: true,
      match: [/^\d{6}$/, 'PIN code must be a 6-digit number']
    }
  },
  { _id: false }
);

const academicInfoSchema = new mongoose.Schema(
  {
    class10Board: {
      type: String,
      required: [true, 'Class 10 board name is required'],
      trim: true
    },
    class10Percentage: {
      type: Number,
      required: [true, 'Class 10 percentage is required'],
      min: [0, 'Percentage cannot be less than 0'],
      max: [100, 'Percentage cannot exceed 100']
    },
    class12Board: {
      type: String,
      required: [true, 'Class 12 board name is required'],
      trim: true
    },
    class12Percentage: {
      type: Number,
      required: [true, 'Class 12 percentage is required'],
      min: [0, 'Percentage cannot be less than 0'],
      max: [100, 'Percentage cannot exceed 100']
    },
    class12PassingYear: {
      type: Number,
      required: [true, 'Class 12 passing year is required'],
      min: [2000, 'Passing year must be after 2000'],
      max: [2030, 'Invalid passing year']
    },
    entranceExamName: {
      type: String,
      trim: true,
      default: ''
    },
    entranceExamScore: {
      type: String,
      trim: true,
      default: ''
    },
    entranceResultType: {
      type: String,
      enum: {
        values: ['Rank', 'Percentile', 'Score', null, ''],
        message: '{VALUE} is not a valid entrance result type'
      },
      default: null
    },
    entranceNumericScore: {
      type: Number,
      default: null
    },
    academicStream: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const admissionInfoSchema = new mongoose.Schema(
  {
    preferredDepartment: {
      type: String,
      trim: true,
      default: null
    },
    admissionCategory: {
      type: String,
      required: [true, 'Admission category is required'],
      enum: {
        values: ['General', 'OBC', 'SC', 'ST', 'EWS', 'Management'],
        message: '{VALUE} is not a valid category'
      }
    }
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: [true, 'Application ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant user reference is required'],
      index: true
    },
    academicSession: {
      type: String,
      required: [true, 'Academic session is required'],
      default: '2026-2027',
      trim: true
    },
    selectedProgramme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Programme',
      index: true
    },
    personalInfo: {
      type: personalInfoSchema,
      required: true
    },
    academicInfo: {
      type: academicInfoSchema,
      required: true
    },
    admissionInfo: {
      type: admissionInfoSchema,
      required: true
    },
    status: {
      type: String,
      enum: {
        values: ['Submitted', 'Under Review', 'Selected', 'Rejected'],
        message: '{VALUE} is not a valid application status'
      },
      default: 'Submitted',
      index: true
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index to prevent duplicate applications for the same applicant and academic session
applicationSchema.index({ applicant: 1, academicSession: 1 }, { unique: true });

// Virtual for uploaded documents
applicationSchema.virtual('documents', {
  ref: 'UploadedDocument',
  localField: '_id',
  foreignField: 'application'
});

// Virtual for status history
applicationSchema.virtual('statusHistory', {
  ref: 'ApplicationStatusHistory',
  localField: '_id',
  foreignField: 'application'
});

applicationSchema.set('toObject', { virtuals: true });
applicationSchema.set('toJSON', { virtuals: true });

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;
