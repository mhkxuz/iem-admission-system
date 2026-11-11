const mongoose = require('mongoose');

const academicSessionSchema = new mongoose.Schema(
  {
    sessionName: {
      type: String,
      required: [true, 'Session name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Session name must be at least 2 characters'],
      maxlength: [50, 'Session name cannot exceed 50 characters']
    },
    sessionCode: {
      type: String,
      required: [true, 'Session code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'Session code must be at least 2 characters'],
      maxlength: [50, 'Session code cannot exceed 50 characters']
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    applicationStartDate: {
      type: Date
    },
    applicationEndDate: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ['Draft', 'Active', 'Closed'],
        message: '{VALUE} is not a valid session status'
      },
      default: 'Draft',
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Date consistency validation
academicSessionSchema.pre('validate', function (next) {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    this.invalidate('startDate', 'Session start date cannot be later than end date.');
  }

  if (
    this.applicationStartDate &&
    this.applicationEndDate &&
    this.applicationStartDate > this.applicationEndDate
  ) {
    this.invalidate(
      'applicationStartDate',
      'Application start date cannot be later than application end date.'
    );
  }

  if (
    this.applicationStartDate &&
    this.endDate &&
    this.applicationStartDate > this.endDate
  ) {
    this.invalidate(
      'applicationStartDate',
      'Application start date cannot be later than session end date.'
    );
  }

  next();
});

const AcademicSession = mongoose.model('AcademicSession', academicSessionSchema);

module.exports = AcademicSession;
