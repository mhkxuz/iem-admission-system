const mongoose = require('mongoose');

const meritConfigurationSchema = new mongoose.Schema(
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
    class12Weightage: {
      type: Number,
      required: [true, 'Class 12 weightage is required'],
      min: [0, 'Class 12 weightage cannot be negative'],
      max: [100, 'Class 12 weightage cannot exceed 100'],
      default: 50
    },
    entranceExamWeightage: {
      type: Number,
      required: [true, 'Entrance examination weightage is required'],
      min: [0, 'Entrance examination weightage cannot be negative'],
      max: [100, 'Entrance examination weightage cannot exceed 100'],
      default: 50
    },
    isEntranceMandatory: {
      type: Boolean,
      default: false
    },
    normalizationMethod: {
      type: String,
      enum: {
        values: ['Score-Based', 'Rank-Based', 'Percentile'],
        message: '{VALUE} is not a supported normalization method'
      },
      default: 'Score-Based'
    },
    maxEntranceScore: {
      type: Number,
      default: 100,
      min: [1, 'Maximum entrance score must be greater than 0']
    },
    maxEntranceRank: {
      type: Number,
      default: 50000,
      min: [1, 'Maximum entrance rank must be greater than 0']
    },
    tieBreakingRules: {
      type: [String],
      default: ['entranceExamScore', 'class12Percentage', 'class10Percentage', 'dob']
    },
    unfilledSeatRule: {
      type: String,
      enum: {
        values: ['Keep Vacant', 'Convert to General'],
        message: '{VALUE} is not a valid unfilled seat rule'
      },
      default: 'Keep Vacant'
    },
    version: {
      type: Number,
      default: 1
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook: Ensure total weightage equals exactly 100%
meritConfigurationSchema.pre('validate', function (next) {
  const c12 = Number(this.class12Weightage) || 0;
  const entrance = Number(this.entranceExamWeightage) || 0;
  if (c12 + entrance !== 100) {
    this.invalidate(
      'entranceExamWeightage',
      `Total weightage must equal 100%. Current sum: Class 12 (${c12}%) + Entrance (${entrance}%) = ${c12 + entrance}%.`
    );
  }
  next();
});

const MeritConfiguration = mongoose.model('MeritConfiguration', meritConfigurationSchema);

module.exports = MeritConfiguration;
