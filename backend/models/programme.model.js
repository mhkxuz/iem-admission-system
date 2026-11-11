const mongoose = require('mongoose');

const categoryAllocationSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true
    },
    seats: {
      type: Number,
      required: [true, 'Allocated category seats are required'],
      min: [0, 'Allocated category seats cannot be negative']
    }
  },
  { _id: false }
);

const seatCapacitySchema = new mongoose.Schema(
  {
    total: {
      type: Number,
      required: [true, 'Total seat capacity is required'],
      min: [0, 'Total seat capacity cannot be negative']
    },
    categoryAllocations: {
      type: [categoryAllocationSchema],
      default: []
    }
  },
  { _id: false }
);

const eligibilitySchema = new mongoose.Schema(
  {
    minClass12Percentage: {
      type: Number,
      min: [0, 'Minimum Class 12 percentage cannot be negative'],
      max: [100, 'Minimum Class 12 percentage cannot exceed 100']
    },
    requiredClass12Subjects: {
      type: [String],
      default: []
    },
    acceptedAcademicStreams: {
      type: [String],
      default: []
    },
    acceptedEntranceExams: {
      type: [String],
      default: []
    },
    minEntranceScore: {
      type: String,
      trim: true,
      default: ''
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    },
    programmeSpecificCriteria: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const sessionOfferingSchema = new mongoose.Schema(
  {
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      required: [true, 'Academic session reference is required']
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    seatCapacity: {
      type: seatCapacitySchema
    }
  },
  { _id: false }
);

const programmeSchema = new mongoose.Schema(
  {
    programmeName: {
      type: String,
      required: [true, 'Programme name is required'],
      trim: true,
      minlength: [2, 'Programme name must be at least 2 characters'],
      maxlength: [150, 'Programme name cannot exceed 150 characters']
    },
    programmeCode: {
      type: String,
      required: [true, 'Programme code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'Programme code must be at least 2 characters'],
      maxlength: [50, 'Programme code cannot exceed 50 characters'],
      index: true
    },
    degreeLevel: {
      type: String,
      required: [true, 'Degree level is required'],
      enum: {
        values: ['Undergraduate', 'Postgraduate', 'Diploma', 'Doctoral'],
        message: '{VALUE} is not a valid degree level'
      },
      default: 'Undergraduate',
      index: true
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true
    },
    degree: {
      type: String,
      required: [true, 'Degree designation is required (e.g. B.Tech, M.Tech, BCA)'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    duration: {
      type: Number,
      required: [true, 'Programme duration is required'],
      min: [0.5, 'Duration must be at least 0.5']
    },
    durationUnit: {
      type: String,
      enum: {
        values: ['years', 'semesters', 'months'],
        message: '{VALUE} is not a valid duration unit'
      },
      default: 'years'
    },
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      index: true
    },
    offeredSessions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AcademicSession'
      }
    ],
    sessionOfferings: [sessionOfferingSchema],
    eligibility: {
      type: eligibilitySchema,
      default: () => ({})
    },
    seatCapacity: {
      type: seatCapacitySchema,
      required: [true, 'Seat capacity configuration is required']
    },
    requiredDocuments: {
      type: [String],
      default: []
    },
    isApplicationOpen: {
      type: Boolean,
      default: true
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true
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

// Pre-validate hook to ensure category allocations do not exceed total seat capacity
programmeSchema.pre('validate', function (next) {
  // Validate base seatCapacity
  if (this.seatCapacity && Array.isArray(this.seatCapacity.categoryAllocations)) {
    const totalAllocated = this.seatCapacity.categoryAllocations.reduce((sum, item) => {
      return sum + (Number(item.seats) || 0);
    }, 0);

    if (totalAllocated > this.seatCapacity.total) {
      this.invalidate(
        'seatCapacity.categoryAllocations',
        `Sum of category-wise allocations (${totalAllocated}) cannot exceed total programme capacity (${this.seatCapacity.total}).`
      );
    }
  }

  // Validate sessionOfferings seat capacities if specified
  if (Array.isArray(this.sessionOfferings)) {
    for (const offering of this.sessionOfferings) {
      if (offering.seatCapacity && Array.isArray(offering.seatCapacity.categoryAllocations)) {
        const offeringAllocated = offering.seatCapacity.categoryAllocations.reduce((sum, item) => {
          return sum + (Number(item.seats) || 0);
        }, 0);

        if (offeringAllocated > offering.seatCapacity.total) {
          this.invalidate(
            'sessionOfferings',
            `Session-specific category allocations (${offeringAllocated}) cannot exceed session total capacity (${offering.seatCapacity.total}).`
          );
          break;
        }
      }
    }
  }

  next();
});

const Programme = mongoose.model('Programme', programmeSchema);

module.exports = Programme;
