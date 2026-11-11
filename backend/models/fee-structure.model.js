const mongoose = require('mongoose');

const semesterFeeSchema = new mongoose.Schema(
  {
    semesterNumber: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: [1, 'Semester number must be at least 1']
    },
    amount: {
      type: Number,
      required: [true, 'Semester fee amount is required'],
      min: [0, 'Semester fee amount cannot be negative']
    }
  },
  { _id: false }
);

const additionalFeeSchema = new mongoose.Schema(
  {
    feeName: {
      type: String,
      required: [true, 'Additional fee name is required'],
      trim: true
    },
    amount: {
      type: Number,
      required: [true, 'Additional fee amount is required'],
      min: [0, 'Additional fee amount cannot be negative']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const feeStructureSchema = new mongoose.Schema(
  {
    programme: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Programme',
      required: [true, 'Programme reference is required'],
      index: true
    },
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      required: [true, 'Academic session reference is required'],
      index: true
    },
    applicationFee: {
      type: Number,
      min: [0, 'Application fee cannot be negative'],
      default: 0
    },
    admissionFee: {
      type: Number,
      min: [0, 'Admission fee cannot be negative'],
      default: 0
    },
    semesterFees: {
      type: [semesterFeeSchema],
      default: []
    },
    additionalFees: {
      type: [additionalFeeSchema],
      default: []
    },
    totalProgrammeFee: {
      type: Number,
      min: [0, 'Total programme fee cannot be negative']
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'INR'
    },
    paymentInstructions: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook for monetary validation, unique semesters, and total calculation consistency
feeStructureSchema.pre('validate', function (next) {
  // 1. Monetary validation: non-negative
  if (this.applicationFee != null && this.applicationFee < 0) {
    this.invalidate('applicationFee', 'Application fee cannot be negative.');
  }
  if (this.admissionFee != null && this.admissionFee < 0) {
    this.invalidate('admissionFee', 'Admission fee cannot be negative.');
  }

  // 2. Semester numbers must be integers >= 1 and unique
  if (Array.isArray(this.semesterFees)) {
    const seenSemesters = new Set();
    for (const sem of this.semesterFees) {
      if (!Number.isInteger(sem.semesterNumber) || sem.semesterNumber < 1) {
        this.invalidate('semesterFees', `Invalid semester number: ${sem.semesterNumber}. Must be a positive integer.`);
        break;
      }
      if (seenSemesters.has(sem.semesterNumber)) {
        this.invalidate(
          'semesterFees',
          `Duplicate semester number detected: Semester ${sem.semesterNumber}. Semester numbers must be unique within a fee structure.`
        );
        break;
      }
      seenSemesters.add(sem.semesterNumber);

      if (sem.amount != null && sem.amount < 0) {
        this.invalidate('semesterFees', `Semester ${sem.semesterNumber} fee amount cannot be negative.`);
        break;
      }
    }
  }

  // 3. Additional fees non-negative
  if (Array.isArray(this.additionalFees)) {
    for (const addFee of this.additionalFees) {
      if (addFee.amount != null && addFee.amount < 0) {
        this.invalidate('additionalFees', `Additional fee '${addFee.feeName}' amount cannot be negative.`);
        break;
      }
    }
  }

  // 4. Total programme fee calculation consistency:
  // Calculation Rule: totalProgrammeFee = admissionFee + sum(semesterFees.amount) + sum(additionalFees.amount)
  // (Note: applicationFee is an upfront application evaluation fee, not part of enrolled programme fee)
  const admission = Number(this.admissionFee) || 0;
  const semesterSum = (this.semesterFees || []).reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const additionalSum = (this.additionalFees || []).reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  const calculatedTotal = Math.round((admission + semesterSum + additionalSum) * 100) / 100;

  if (this.totalProgrammeFee == null) {
    this.totalProgrammeFee = calculatedTotal;
  } else {
    const providedTotal = Number(this.totalProgrammeFee);
    if (Math.abs(providedTotal - calculatedTotal) > 0.01) {
      this.invalidate(
        'totalProgrammeFee',
        `Total programme fee (${providedTotal}) must be consistent with the sum of admission fee (${admission}), semester fees (${semesterSum}), and additional fees (${additionalSum}), which totals ${calculatedTotal}.`
      );
    }
  }

  next();
});

// Partial unique compound index to ensure only one active fee structure exists per (programme, academicSession)
feeStructureSchema.index(
  { programme: 1, academicSession: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'unique_active_fee_per_programme_session'
  }
);

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);

module.exports = FeeStructure;
