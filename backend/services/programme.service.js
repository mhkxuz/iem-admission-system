const mongoose = require('mongoose');
const Programme = require('../models/programme.model');
const AcademicSession = require('../models/academic-session.model');
const AppError = require('../utils/app-error');

/**
 * Helper to resolve an AcademicSession reference from an ID, name, or code.
 */
async function resolveSessionId(sessionIdentifier) {
  if (!sessionIdentifier) return null;

  if (mongoose.Types.ObjectId.isValid(sessionIdentifier)) {
    const session = await AcademicSession.findById(sessionIdentifier);
    if (!session) {
      throw new AppError(`Academic session with ID '${sessionIdentifier}' does not exist.`, 404);
    }
    return session._id;
  }

  const session = await AcademicSession.findOne({
    $or: [{ sessionName: sessionIdentifier }, { sessionCode: sessionIdentifier }]
  });

  if (!session) {
    throw new AppError(`Academic session '${sessionIdentifier}' does not exist.`, 404);
  }

  return session._id;
}

/**
 * Create a new academic programme.
 */
async function createProgramme(programmeData) {
  const code = (programmeData.programmeCode || '').trim().toUpperCase();
  if (!code) {
    throw new AppError('Programme code is required.', 400);
  }

  // Check code uniqueness
  const existing = await Programme.findOne({ programmeCode: code });
  if (existing) {
    throw new AppError(`A programme with code '${code}' already exists.`, 409);
  }

  const dataToSave = { ...programmeData, programmeCode: code };

  // Resolve academicSession if provided
  if (dataToSave.academicSession) {
    dataToSave.academicSession = await resolveSessionId(dataToSave.academicSession);
  }

  // Resolve and normalize offeredSessions
  if (Array.isArray(dataToSave.offeredSessions)) {
    const resolvedSessions = [];
    for (const sess of dataToSave.offeredSessions) {
      const resolvedId = await resolveSessionId(sess);
      if (resolvedId && !resolvedSessions.some((id) => id.equals(resolvedId))) {
        resolvedSessions.push(resolvedId);
      }
    }
    dataToSave.offeredSessions = resolvedSessions;
  } else {
    dataToSave.offeredSessions = [];
  }

  // Ensure primary academicSession is part of offeredSessions
  if (
    dataToSave.academicSession &&
    !dataToSave.offeredSessions.some((id) => id.equals(dataToSave.academicSession))
  ) {
    dataToSave.offeredSessions.push(dataToSave.academicSession);
  }

  // Validate seat capacity
  if (!dataToSave.seatCapacity || dataToSave.seatCapacity.total == null) {
    throw new AppError('Total seat capacity is required.', 400);
  }

  const programme = new Programme(dataToSave);
  await programme.save();

  return Programme.findById(programme._id)
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');
}

/**
 * List all programmes for administrative review with search, filtering and pagination.
 */
async function getAllAdminProgrammes(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  // Search by programmeName, programmeCode, or department
  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { programmeName: searchRegex },
      { programmeCode: searchRegex },
      { department: searchRegex }
    ];
  }

  // Filter by department
  if (query.department && query.department.trim()) {
    filter.department = query.department.trim();
  }

  // Filter by degreeLevel
  if (query.degreeLevel && query.degreeLevel.trim()) {
    filter.degreeLevel = query.degreeLevel.trim();
  }

  // Filter by isActive status
  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  // Filter by session
  if (query.session && query.session.trim()) {
    try {
      const sessionId = await resolveSessionId(query.session.trim());
      filter.$or = filter.$or || [];
      const sessionFilter = [
        { academicSession: sessionId },
        { offeredSessions: sessionId },
        { 'sessionOfferings.academicSession': sessionId }
      ];
      if (filter.$or.length > 0) {
        filter.$and = [{ $or: filter.$or }, { $or: sessionFilter }];
        delete filter.$or;
      } else {
        filter.$or = sessionFilter;
      }
    } catch {
      // If session doesn't exist, return empty results
      return {
        programmes: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
  }

  const [programmes, total] = await Promise.all([
    Programme.find(filter)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('academicSession', 'sessionName sessionCode isActive status')
      .populate('offeredSessions', 'sessionName sessionCode isActive status'),
    Programme.countDocuments(filter)
  ]);

  return {
    programmes,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Retrieve programme by MongoDB ID (Admin).
 */
async function getProgrammeById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const programme = await Programme.findById(id)
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');

  if (!programme) {
    throw new AppError('Academic programme not found.', 404);
  }

  return programme;
}

/**
 * Retrieve programme by programme code (Admin / Internal).
 */
async function getProgrammeByCode(code) {
  const formattedCode = (code || '').trim().toUpperCase();
  const programme = await Programme.findOne({ programmeCode: formattedCode })
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');

  if (!programme) {
    throw new AppError(`Academic programme with code '${formattedCode}' not found.`, 404);
  }

  return programme;
}

/**
 * Update an existing programme.
 */
async function updateProgramme(id, updateData) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const programme = await Programme.findById(id);
  if (!programme) {
    throw new AppError('Academic programme not found.', 404);
  }

  // If code is being changed, verify uniqueness
  if (updateData.programmeCode) {
    const newCode = updateData.programmeCode.trim().toUpperCase();
    if (newCode !== programme.programmeCode) {
      const codeConflict = await Programme.findOne({
        programmeCode: newCode,
        _id: { $ne: id }
      });
      if (codeConflict) {
        throw new AppError(`A programme with code '${newCode}' already exists.`, 409);
      }
      programme.programmeCode = newCode;
    }
  }

  // Resolve academicSession if updating
  if (updateData.academicSession !== undefined) {
    programme.academicSession = await resolveSessionId(updateData.academicSession);
  }

  // Resolve offeredSessions if updating
  if (Array.isArray(updateData.offeredSessions)) {
    const resolvedSessions = [];
    for (const sess of updateData.offeredSessions) {
      const resolvedId = await resolveSessionId(sess);
      if (resolvedId && !resolvedSessions.some((id) => id.equals(resolvedId))) {
        resolvedSessions.push(resolvedId);
      }
    }
    programme.offeredSessions = resolvedSessions;
  }

  // Update scalar fields
  const allowedFields = [
    'programmeName',
    'degreeLevel',
    'department',
    'degree',
    'description',
    'duration',
    'durationUnit',
    'isApplicationOpen',
    'displayOrder',
    'requiredDocuments',
    'eligibility',
    'seatCapacity',
    'sessionOfferings',
    'isActive'
  ];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      programme[field] = updateData[field];
    }
  }

  await programme.save();

  return Programme.findById(programme._id)
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');
}

/**
 * Activate a programme.
 */
async function activateProgramme(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const programme = await Programme.findByIdAndUpdate(
    id,
    { isActive: true },
    { new: true, runValidators: true }
  )
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');

  if (!programme) {
    throw new AppError('Academic programme not found.', 404);
  }

  return programme;
}

/**
 * Deactivate a programme.
 */
async function deactivateProgramme(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const programme = await Programme.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true, runValidators: true }
  )
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');

  if (!programme) {
    throw new AppError('Academic programme not found.', 404);
  }

  return programme;
}

/**
 * Publicly list active academic programmes.
 */
async function getPublicProgrammes(query = {}) {
  const filter = { isActive: true };

  if (query.department && query.department.trim()) {
    filter.department = query.department.trim();
  }

  if (query.degreeLevel && query.degreeLevel.trim()) {
    filter.degreeLevel = query.degreeLevel.trim();
  }

  if (query.session && query.session.trim()) {
    try {
      const sessionId = await resolveSessionId(query.session.trim());
      filter.$or = [
        { academicSession: sessionId },
        { offeredSessions: sessionId },
        { 'sessionOfferings.academicSession': sessionId }
      ];
    } catch {
      return [];
    }
  }

  const programmes = await Programme.find(filter)
    .select(
      'programmeName programmeCode degreeLevel department degree description duration durationUnit eligibility seatCapacity requiredDocuments isApplicationOpen displayOrder academicSession offeredSessions'
    )
    .sort({ displayOrder: 1, programmeName: 1 })
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');

  return programmes;
}

/**
 * Publicly retrieve an active programme by ID.
 */
async function getPublicProgrammeById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const programme = await Programme.findOne({ _id: id, isActive: true })
    .select(
      'programmeName programmeCode degreeLevel department degree description duration durationUnit eligibility seatCapacity requiredDocuments isApplicationOpen displayOrder academicSession offeredSessions'
    )
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');

  if (!programme) {
    throw new AppError('Academic programme not found or is currently inactive.', 404);
  }

  return programme;
}

/**
 * Publicly retrieve an active programme by code.
 */
async function getPublicProgrammeByCode(code) {
  const formattedCode = (code || '').trim().toUpperCase();

  const programme = await Programme.findOne({ programmeCode: formattedCode, isActive: true })
    .select(
      'programmeName programmeCode degreeLevel department degree description duration durationUnit eligibility seatCapacity requiredDocuments isApplicationOpen displayOrder academicSession offeredSessions'
    )
    .populate('academicSession', 'sessionName sessionCode isActive status')
    .populate('offeredSessions', 'sessionName sessionCode isActive status');

  if (!programme) {
    throw new AppError(`Academic programme '${formattedCode}' not found or is currently inactive.`, 404);
  }

  return programme;
}

/**
 * Admin: Delete a programme if no existing applications reference it.
 */
async function deleteProgramme(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const { Application } = require('../models');
  const appCount = await Application.countDocuments({ selectedProgramme: id });
  if (appCount > 0) {
    throw new AppError(
      `Cannot delete programme: ${appCount} application(s) reference this programme. Please deactivate it instead to preserve application records.`,
      400
    );
  }

  const programme = await Programme.findByIdAndDelete(id);
  if (!programme) {
    throw new AppError('Academic programme not found.', 404);
  }

  return programme;
}

/**
 * Ensures default IEM academic programmes and active fee structures exist on startup.
 */
async function ensureDefaultProgrammesAndFees() {
  const count = await Programme.countDocuments();
  if (count > 0) {
    return;
  }

  // Find active session
  let activeSession = await AcademicSession.findOne({ isActive: true });
  if (!activeSession) {
    activeSession = await AcademicSession.findOne({ sessionName: '2026-2027' });
  }
  if (!activeSession) {
    return;
  }

  const FeeStructure = require('../models/fee-structure.model');

  const defaultProgrammes = [
    {
      programmeName: 'B.Tech in Computer Science & Engineering',
      programmeCode: 'BTECH-CSE',
      degreeLevel: 'Undergraduate',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years',
      description: 'Flagship undergraduate engineering programme focusing on software systems, algorithms, artificial intelligence, and cloud architectures.',
      displayOrder: 1,
      isActive: true,
      isApplicationOpen: true,
      academicSession: activeSession._id,
      offeredSessions: [activeSession._id],
      seatCapacity: {
        total: 120,
        categoryAllocations: [
          { category: 'General', seats: 60 },
          { category: 'OBC', seats: 30 },
          { category: 'SC', seats: 18 },
          { category: 'ST', seats: 6 },
          { category: 'EWS', seats: 6 }
        ]
      },
      sessionOfferings: [
        {
          academicSession: activeSession._id,
          isAvailable: true,
          seatCapacity: {
            total: 120,
            categoryAllocations: [
              { category: 'General', seats: 60 },
              { category: 'OBC', seats: 30 },
              { category: 'SC', seats: 18 },
              { category: 'ST', seats: 6 },
              { category: 'EWS', seats: 6 }
            ]
          }
        }
      ],
      eligibility: {
        minClass12Percentage: 60,
        requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry'],
        acceptedAcademicStreams: ['Science (PCM)'],
        acceptedEntranceExams: ['WBJEE', 'JEE Main']
      },
      fee: {
        admissionFee: 50000,
        applicationFee: 1000,
        semesterFees: Array.from({ length: 8 }, (_, i) => ({ semesterNumber: i + 1, amount: 45000 })),
        additionalFees: [{ feeName: 'Library & Laboratory Deposit', amount: 10000, description: 'Comprehensive campus facility deposit' }],
        paymentInstructions: 'Admission confirmation fee payable online via official IEM portal.'
      }
    },
    {
      programmeName: 'B.Tech in Information Technology',
      programmeCode: 'BTECH-IT',
      degreeLevel: 'Undergraduate',
      department: 'Information Technology',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years',
      description: 'Industry-oriented programme covering enterprise software development, networks, data engineering, and cybersecurity.',
      displayOrder: 2,
      isActive: true,
      isApplicationOpen: true,
      academicSession: activeSession._id,
      offeredSessions: [activeSession._id],
      seatCapacity: {
        total: 60,
        categoryAllocations: [
          { category: 'General', seats: 30 },
          { category: 'OBC', seats: 15 },
          { category: 'SC', seats: 9 },
          { category: 'ST', seats: 3 },
          { category: 'EWS', seats: 3 }
        ]
      },
      sessionOfferings: [
        {
          academicSession: activeSession._id,
          isAvailable: true,
          seatCapacity: {
            total: 60,
            categoryAllocations: [
              { category: 'General', seats: 30 },
              { category: 'OBC', seats: 15 },
              { category: 'SC', seats: 9 },
              { category: 'ST', seats: 3 },
              { category: 'EWS', seats: 3 }
            ]
          }
        }
      ],
      eligibility: {
        minClass12Percentage: 60,
        requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry'],
        acceptedAcademicStreams: ['Science (PCM)'],
        acceptedEntranceExams: ['WBJEE', 'JEE Main']
      },
      fee: {
        admissionFee: 50000,
        applicationFee: 1000,
        semesterFees: Array.from({ length: 8 }, (_, i) => ({ semesterNumber: i + 1, amount: 45000 })),
        additionalFees: [{ feeName: 'Library & Laboratory Deposit', amount: 10000, description: 'Comprehensive campus facility deposit' }],
        paymentInstructions: 'Admission confirmation fee payable online via official IEM portal.'
      }
    },
    {
      programmeName: 'B.Tech in Electronics & Communication Engineering',
      programmeCode: 'BTECH-ECE',
      degreeLevel: 'Undergraduate',
      department: 'Electronics & Communication Engineering',
      degree: 'B.Tech',
      duration: 4,
      durationUnit: 'years',
      description: 'Comprehensive curriculum spanning embedded systems, VLSI design, wireless communication, and robotics.',
      displayOrder: 3,
      isActive: true,
      isApplicationOpen: true,
      academicSession: activeSession._id,
      offeredSessions: [activeSession._id],
      seatCapacity: {
        total: 60,
        categoryAllocations: [
          { category: 'General', seats: 30 },
          { category: 'OBC', seats: 15 },
          { category: 'SC', seats: 9 },
          { category: 'ST', seats: 3 },
          { category: 'EWS', seats: 3 }
        ]
      },
      sessionOfferings: [
        {
          academicSession: activeSession._id,
          isAvailable: true,
          seatCapacity: {
            total: 60,
            categoryAllocations: [
              { category: 'General', seats: 30 },
              { category: 'OBC', seats: 15 },
              { category: 'SC', seats: 9 },
              { category: 'ST', seats: 3 },
              { category: 'EWS', seats: 3 }
            ]
          }
        }
      ],
      eligibility: {
        minClass12Percentage: 60,
        requiredClass12Subjects: ['Physics', 'Mathematics', 'Chemistry'],
        acceptedAcademicStreams: ['Science (PCM)'],
        acceptedEntranceExams: ['WBJEE', 'JEE Main']
      },
      fee: {
        admissionFee: 50000,
        applicationFee: 1000,
        semesterFees: Array.from({ length: 8 }, (_, i) => ({ semesterNumber: i + 1, amount: 45000 })),
        additionalFees: [{ feeName: 'Laboratory & Equipment Fee', amount: 10000, description: 'Hardware lab and cleanroom access' }],
        paymentInstructions: 'Admission confirmation fee payable online via official IEM portal.'
      }
    },
    {
      programmeName: 'Bachelor of Computer Applications',
      programmeCode: 'BCA',
      degreeLevel: 'Undergraduate',
      department: 'Computer Applications',
      degree: 'BCA',
      duration: 3,
      durationUnit: 'years',
      description: 'Undergraduate computer application programme providing a strong foundation in programming, web development, and database systems.',
      displayOrder: 4,
      isActive: true,
      isApplicationOpen: true,
      academicSession: activeSession._id,
      offeredSessions: [activeSession._id],
      seatCapacity: {
        total: 60,
        categoryAllocations: [
          { category: 'General', seats: 30 },
          { category: 'OBC', seats: 15 },
          { category: 'SC', seats: 9 },
          { category: 'ST', seats: 3 },
          { category: 'EWS', seats: 3 }
        ]
      },
      sessionOfferings: [
        {
          academicSession: activeSession._id,
          isAvailable: true,
          seatCapacity: {
            total: 60,
            categoryAllocations: [
              { category: 'General', seats: 30 },
              { category: 'OBC', seats: 15 },
              { category: 'SC', seats: 9 },
              { category: 'ST', seats: 3 },
              { category: 'EWS', seats: 3 }
            ]
          }
        }
      ],
      eligibility: {
        minClass12Percentage: 50,
        requiredClass12Subjects: ['Mathematics or Computer Science'],
        acceptedAcademicStreams: ['Science (PCM)', 'Science (General)', 'Commerce'],
        acceptedEntranceExams: []
      },
      fee: {
        admissionFee: 30000,
        applicationFee: 800,
        semesterFees: Array.from({ length: 6 }, (_, i) => ({ semesterNumber: i + 1, amount: 35000 })),
        additionalFees: [{ feeName: 'Computer Lab Access', amount: 5000, description: 'Dedicated terminal allocation' }],
        paymentInstructions: 'Admission confirmation fee payable online via official IEM portal.'
      }
    },
    {
      programmeName: 'Master of Computer Applications',
      programmeCode: 'MCA',
      degreeLevel: 'Postgraduate',
      department: 'Computer Applications',
      degree: 'MCA',
      duration: 2,
      durationUnit: 'years',
      description: 'Advanced computer applications postgraduate programme focused on cloud computing, full-stack architectures, and data science.',
      displayOrder: 5,
      isActive: true,
      isApplicationOpen: true,
      academicSession: activeSession._id,
      offeredSessions: [activeSession._id],
      seatCapacity: {
        total: 60,
        categoryAllocations: [
          { category: 'General', seats: 30 },
          { category: 'OBC', seats: 15 },
          { category: 'SC', seats: 9 },
          { category: 'ST', seats: 3 },
          { category: 'EWS', seats: 3 }
        ]
      },
      sessionOfferings: [
        {
          academicSession: activeSession._id,
          isAvailable: true,
          seatCapacity: {
            total: 60,
            categoryAllocations: [
              { category: 'General', seats: 30 },
              { category: 'OBC', seats: 15 },
              { category: 'SC', seats: 9 },
              { category: 'ST', seats: 3 },
              { category: 'EWS', seats: 3 }
            ]
          }
        }
      ],
      eligibility: {
        minClass12Percentage: 50,
        requiredClass12Subjects: [],
        acceptedAcademicStreams: [],
        acceptedEntranceExams: ['WB JECA', 'NIMCET']
      },
      fee: {
        admissionFee: 40000,
        applicationFee: 1000,
        semesterFees: Array.from({ length: 4 }, (_, i) => ({ semesterNumber: i + 1, amount: 40000 })),
        additionalFees: [{ feeName: 'Advanced Computing Lab', amount: 8000, description: 'Server and cloud lab cluster access' }],
        paymentInstructions: 'Admission confirmation fee payable online via official IEM portal.'
      }
    },
    {
      programmeName: 'Master of Business Administration',
      programmeCode: 'MBA',
      degreeLevel: 'Postgraduate',
      department: 'Management Studies',
      degree: 'MBA',
      duration: 2,
      durationUnit: 'years',
      description: 'Premier management programme developing leadership across finance, marketing, human resources, and business analytics.',
      displayOrder: 6,
      isActive: true,
      isApplicationOpen: true,
      academicSession: activeSession._id,
      offeredSessions: [activeSession._id],
      seatCapacity: {
        total: 60,
        categoryAllocations: [
          { category: 'General', seats: 30 },
          { category: 'OBC', seats: 15 },
          { category: 'SC', seats: 9 },
          { category: 'ST', seats: 3 },
          { category: 'EWS', seats: 3 }
        ]
      },
      sessionOfferings: [
        {
          academicSession: activeSession._id,
          isAvailable: true,
          seatCapacity: {
            total: 60,
            categoryAllocations: [
              { category: 'General', seats: 30 },
              { category: 'OBC', seats: 15 },
              { category: 'SC', seats: 9 },
              { category: 'ST', seats: 3 },
              { category: 'EWS', seats: 3 }
            ]
          }
        }
      ],
      eligibility: {
        minClass12Percentage: 50,
        requiredClass12Subjects: [],
        acceptedAcademicStreams: [],
        acceptedEntranceExams: ['CAT', 'MAT', 'JEMAT']
      },
      fee: {
        admissionFee: 60000,
        applicationFee: 1200,
        semesterFees: Array.from({ length: 4 }, (_, i) => ({ semesterNumber: i + 1, amount: 65000 })),
        additionalFees: [{ feeName: 'Corporate Immersion & Development', amount: 15000, description: 'Industry workshops and executive development' }],
        paymentInstructions: 'Admission confirmation fee payable online via official IEM portal.'
      }
    }
  ];

  for (const item of defaultProgrammes) {
    const { fee, ...progData } = item;
    const createdProg = await Programme.create(progData);

    const semesterSum = fee.semesterFees.reduce((acc, s) => acc + s.amount, 0);
    const additionalSum = fee.additionalFees.reduce((acc, a) => acc + a.amount, 0);
    const totalProgrammeFee = fee.admissionFee + semesterSum + additionalSum;

    await FeeStructure.create({
      programme: createdProg._id,
      academicSession: activeSession._id,
      applicationFee: fee.applicationFee,
      admissionFee: fee.admissionFee,
      semesterFees: fee.semesterFees,
      additionalFees: fee.additionalFees,
      totalProgrammeFee,
      currency: 'INR',
      paymentInstructions: fee.paymentInstructions,
      isActive: true
    });
  }

  console.log(`[Seed Success] Initialized ${defaultProgrammes.length} default academic programmes and active fee structures.`);
}

module.exports = {
  createProgramme,
  getAllAdminProgrammes,
  getProgrammeById,
  getProgrammeByCode,
  updateProgramme,
  activateProgramme,
  deactivateProgramme,
  deleteProgramme,
  getPublicProgrammes,
  getPublicProgrammeById,
  getPublicProgrammeByCode,
  ensureDefaultProgrammesAndFees
};
