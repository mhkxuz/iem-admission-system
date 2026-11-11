const mongoose = require('mongoose');
const {
  Programme,
  Application,
  UploadedDocument,
  AcademicSession,
  MeritConfiguration,
  MeritList,
  SeatAllocation
} = require('../models');
const AppError = require('../utils/app-error');

/**
 * Save or update merit scoring configuration for a programme and session.
 */
async function saveMeritConfiguration({
  programmeId,
  academicSession,
  class12Weightage = 50,
  entranceExamWeightage = 50,
  isEntranceMandatory = false,
  normalizationMethod = 'Score-Based',
  maxEntranceScore = 100,
  maxEntranceRank = 50000,
  tieBreakingRules = ['entranceExamScore', 'class12Percentage', 'class10Percentage', 'dob'],
  unfilledSeatRule = 'Keep Vacant',
  adminId
}) {
  if (!mongoose.Types.ObjectId.isValid(programmeId)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const programme = await Programme.findById(programmeId);
  if (!programme) {
    throw new AppError('Academic programme not found.', 404);
  }

  if (Number(class12Weightage) + Number(entranceExamWeightage) !== 100) {
    throw new AppError('Total weightage must equal exactly 100%.', 400);
  }

  const existingConfig = await MeritConfiguration.findOne({
    programme: programmeId,
    academicSession: academicSession.trim()
  });

  const nextVersion = existingConfig ? existingConfig.version + 1 : 1;

  const config = await MeritConfiguration.findOneAndUpdate(
    { programme: programmeId, academicSession: academicSession.trim() },
    {
      programme: programmeId,
      academicSession: academicSession.trim(),
      class12Weightage: Number(class12Weightage),
      entranceExamWeightage: Number(entranceExamWeightage),
      isEntranceMandatory: Boolean(isEntranceMandatory),
      normalizationMethod,
      maxEntranceScore: Number(maxEntranceScore) || 100,
      maxEntranceRank: Number(maxEntranceRank) || 50000,
      tieBreakingRules,
      unfilledSeatRule,
      version: nextVersion,
      createdBy: adminId,
      isActive: true
    },
    { new: true, upsert: true, runValidators: true }
  ).populate('programme', 'programmeName programmeCode department degree');

  return config;
}

/**
 * Retrieve active merit configuration for a programme and session.
 */
async function getMeritConfiguration(programmeId, academicSession) {
  if (!mongoose.Types.ObjectId.isValid(programmeId)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const config = await MeritConfiguration.findOne({
    programme: programmeId,
    academicSession: academicSession ? academicSession.trim() : undefined
  }).populate('programme', 'programmeName programmeCode department degree');

  if (!config) {
    return {
      programme: programmeId,
      academicSession,
      class12Weightage: 60,
      entranceExamWeightage: 40,
      normalizationMethod: 'Rank-Based',
      maxEntranceRank: 50000,
      maxEntranceScore: 100,
      tieBreakingPriority: [
        'entranceExamScore',
        'class12Percentage',
        'class10Percentage',
        'dob'
      ],
      unfilledSeatRule: 'Keep Vacant',
      version: 0,
      isDefault: true
    };
  }

  return config;
}

/**
 * Normalizes entrance examination score/rank into a uniform 0 - 100 percentage scale.
 * Supports structured result types ('Rank', 'Percentile', 'Score') and legacy strings.
 */
function normalizeEntranceScore(
  rawScore,
  method,
  maxScore = 100,
  maxRank = 50000,
  resultType = null,
  numericValue = null
) {
  let val = numericValue != null && !isNaN(Number(numericValue)) ? Number(numericValue) : null;
  let effectiveType = resultType;

  if (val == null) {
    if (!rawScore || typeof rawScore !== 'string' || !rawScore.trim()) {
      return 0;
    }

    const clean = rawScore.trim();
    if (!effectiveType) {
      if (/rank/i.test(clean)) effectiveType = 'Rank';
      else if (/percentile|%ile/i.test(clean)) effectiveType = 'Percentile';
      else if (/score|marks/i.test(clean)) effectiveType = 'Score';
    }

    const numericMatch = clean.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (!numericMatch) {
      return 0;
    }

    val = parseFloat(numericMatch[0]);
    if (isNaN(val)) {
      return 0;
    }
  }

  // Determine effective normalization method:
  // Explicit resultType overrides generic method if specified
  let effectiveMethod = method;
  if (effectiveType === 'Rank') effectiveMethod = 'Rank-Based';
  else if (effectiveType === 'Percentile') effectiveMethod = 'Percentile';
  else if (effectiveType === 'Score') effectiveMethod = 'Score-Based';

  if (effectiveMethod === 'Rank-Based') {
    // In Rank-Based scoring, rank 1 is best.
    // Normalized score = max(0, min(100, (1 - (rank - 1) / maxRank) * 100))
    if (val <= 0) return 0;
    const normalized = (1 - (val - 1) / maxRank) * 100;
    return Math.max(0, Math.min(100, Number(normalized.toFixed(4))));
  }

  if (effectiveMethod === 'Percentile') {
    // Percentile is already 0 - 100
    return Math.max(0, Math.min(100, Number(val.toFixed(4))));
  }

  // Default: Score-Based
  const normalized = (val / maxScore) * 100;
  return Math.max(0, Math.min(100, Number(normalized.toFixed(4))));
}

/**
 * Evaluates programme eligibility criteria and document verification status for an application.
 */
function screenEligibility(application, programme, documents, config) {
  const academic = application.academicInfo || {};
  const eligibility = programme.eligibility || {};

  // 1. Programme active status
  if (!programme.isActive) {
    return {
      status: 'Ineligible',
      remarks: 'Selected academic programme is currently inactive.',
      documentStatus: 'N/A'
    };
  }

  // 2. Minimum Class 12 aggregate cutoff check
  const c12Percentage = Number(academic.class12Percentage) || 0;
  if (eligibility.minClass12Percentage && c12Percentage < eligibility.minClass12Percentage) {
    return {
      status: 'Ineligible',
      remarks: `Class 12 percentage (${c12Percentage}%) does not meet minimum eligibility cutoff of ${eligibility.minClass12Percentage}%.`,
      documentStatus: 'N/A'
    };
  }

  // 3. Accepted academic streams
  if (
    Array.isArray(eligibility.acceptedAcademicStreams) &&
    eligibility.acceptedAcademicStreams.length > 0 &&
    academic.academicStream
  ) {
    if (!eligibility.acceptedAcademicStreams.includes(academic.academicStream)) {
      return {
        status: 'Ineligible',
        remarks: `Academic stream '${academic.academicStream}' is not accepted. Eligible streams: ${eligibility.acceptedAcademicStreams.join(', ')}.`,
        documentStatus: 'N/A'
      };
    }
  }

  // 4. Mandatory entrance exam check
  if (config.isEntranceMandatory) {
    if (!academic.entranceExamName || !academic.entranceExamScore) {
      return {
        status: 'Ineligible',
        remarks: 'Entrance examination score or rank is mandatory for this programme.',
        documentStatus: 'N/A'
      };
    }
  }

  // 5. Document verification check
  const appDocs = documents.filter(
    (d) => d.application.toString() === application._id.toString()
  );

  const hasRejected = appDocs.some((d) => d.verificationStatus === 'Rejected');
  const hasPending = appDocs.some((d) => !d.verificationStatus || d.verificationStatus === 'Pending');

  if (hasRejected) {
    const rejectedTypes = appDocs
      .filter((d) => d.verificationStatus === 'Rejected')
      .map((d) => d.documentType)
      .join(', ');
    return {
      status: 'Ineligible',
      remarks: `Mandatory verification documents rejected: ${rejectedTypes}.`,
      documentStatus: 'Has Rejected Documents'
    };
  }

  if (hasPending || appDocs.length === 0) {
    return {
      status: 'Eligible (Pending Documents)',
      remarks: 'Meets academic criteria. Awaiting completion of document verification.',
      documentStatus: appDocs.length === 0 ? 'No Documents Uploaded' : 'Pending Verification'
    };
  }

  return {
    status: 'Eligible',
    remarks: 'Meets all academic eligibility and document verification requirements.',
    documentStatus: 'All Verified'
  };
}

/**
 * Deterministic tie-breaking comparator.
 */
function compareApplicants(a, b, tieRules) {
  // 1. Primary: Composite Score (descending)
  if (b.compositeScore !== a.compositeScore) {
    return b.compositeScore - a.compositeScore;
  }

  // 2. Configured Tie-Breaking Rules in sequential priority
  const rules = Array.isArray(tieRules) ? tieRules : [];
  for (const rule of rules) {
    if (rule === 'entranceExamScore' || rule === 'higher_entrance_score') {
      const scoreA = a.normalizedEntranceScore !== undefined ? a.normalizedEntranceScore : Number(a.entranceExamScore) || 0;
      const scoreB = b.normalizedEntranceScore !== undefined ? b.normalizedEntranceScore : Number(b.entranceExamScore) || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
    } else if (rule === 'class12Percentage' || rule === 'higher_class12_percentage') {
      if (b.class12Percentage !== a.class12Percentage) {
        return b.class12Percentage - a.class12Percentage;
      }
    } else if (rule === 'class10Percentage' || rule === 'higher_class10_percentage') {
      const c10A = Number(a.rawClass10 !== undefined ? a.rawClass10 : a.class10Percentage) || 0;
      const c10B = Number(b.rawClass10 !== undefined ? b.rawClass10 : b.class10Percentage) || 0;
      if (c10B !== c10A) {
        return c10B - c10A;
      }
    } else if (rule === 'dob' || rule === 'older_candidate_age') {
      // Older candidate gets higher priority (earlier date of birth)
      const dobA = a.dob ? new Date(a.dob).getTime() : 0;
      const dobB = b.dob ? new Date(b.dob).getTime() : 0;
      if (dobA && dobB && dobA !== dobB) {
        return dobA - dobB; // Earlier date (smaller timestamp) comes first
      }
    }
  }

  // 3. Fallback: Submission date (earlier submission first)
  const subA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
  const subB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
  return subA - subB;
}

/**
 * Generate a complete, ranked merit list for a programme and academic session.
 */
async function generateMeritList({ programmeId, academicSession, adminId }) {
  if (!mongoose.Types.ObjectId.isValid(programmeId)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const programme = await Programme.findById(programmeId);
  if (!programme) {
    throw new AppError('Academic programme not found.', 404);
  }

  const sessionName = academicSession ? academicSession.trim() : '2026-2027';

  // 1. Load active merit configuration (or use sensible defaults)
  let config = await MeritConfiguration.findOne({
    programme: programmeId,
    academicSession: sessionName
  });

  if (!config) {
    config = {
      class12Weightage: 50,
      entranceExamWeightage: 50,
      isEntranceMandatory: false,
      normalizationMethod: 'Score-Based',
      maxEntranceScore: 100,
      maxEntranceRank: 50000,
      tieBreakingRules: ['entranceExamScore', 'class12Percentage', 'class10Percentage', 'dob'],
      unfilledSeatRule: 'Keep Vacant',
      version: 1
    };
  }

  // 2. Fetch all applications for this programme and session
  const applications = await Application.find({
    selectedProgramme: programmeId,
    academicSession: sessionName
  }).populate('applicant', 'fullName email phone');

  if (applications.length === 0) {
    throw new AppError(
      `No applications found for programme '${programme.programmeName}' in academic session '${sessionName}'.`,
      404
    );
  }

  const appIds = applications.map((a) => a._id);
  const documents = await UploadedDocument.find({ application: { $in: appIds } });

  // 3. Score and screen each applicant
  const entries = [];
  const c12Weight = (config.class12Weightage || 50) / 100;
  const entranceWeight = (config.entranceExamWeightage || 50) / 100;

  for (const app of applications) {
    const academic = app.academicInfo || {};
    const personal = app.personalInfo || {};
    const admission = app.admissionInfo || {};

    const c12 = Number(academic.class12Percentage) || 0;
    const rawEntrance = academic.entranceExamScore || '';
    const normEntrance = normalizeEntranceScore(
      rawEntrance,
      config.normalizationMethod,
      config.maxEntranceScore,
      config.maxEntranceRank,
      academic.entranceResultType,
      academic.entranceNumericScore
    );

    const composite = Number((c12 * c12Weight + normEntrance * entranceWeight).toFixed(4));
    const screening = screenEligibility(app, programme, documents, config);

    entries.push({
      application: app._id,
      applicant: app.applicant?._id || app.applicant,
      applicationId: app.applicationId,
      candidateName: personal.fullName || app.applicant?.fullName || 'Applicant',
      category: admission.admissionCategory || 'General',
      class12Percentage: c12,
      rawEntranceScore: rawEntrance,
      normalizedEntranceScore: normEntrance,
      compositeScore: composite,
      rawClass10: academic.class10Percentage,
      dob: personal.dob,
      submittedAt: app.submittedAt,
      eligibilityStatus: screening.status,
      eligibilityRemarks: screening.remarks,
      documentStatus: screening.documentStatus
    });
  }

  // 4. Deterministic Ranking
  // Separate eligible (and eligible pending docs) from ineligible
  const eligibleGroup = entries.filter((e) => e.eligibilityStatus !== 'Ineligible');
  const ineligibleGroup = entries.filter((e) => e.eligibilityStatus === 'Ineligible');

  const tieRules = config.tieBreakingRules || [
    'entranceExamScore',
    'class12Percentage',
    'class10Percentage',
    'dob'
  ];

  eligibleGroup.sort((a, b) => compareApplicants(a, b, tieRules));
  ineligibleGroup.sort((a, b) => compareApplicants(a, b, tieRules));

  // Assign overall meritRank to eligible applicants
  eligibleGroup.forEach((item, index) => {
    item.meritRank = index + 1;
  });

  // Assign rank 0 for ineligible applicants
  ineligibleGroup.forEach((item) => {
    item.meritRank = 0;
    item.categoryRank = 0;
  });

  // Compute category-wise ranks for eligible applicants
  const categoryCounters = {};
  for (const item of eligibleGroup) {
    categoryCounters[item.category] = (categoryCounters[item.category] || 0) + 1;
    item.categoryRank = categoryCounters[item.category];
  }

  const finalEntries = [...eligibleGroup, ...ineligibleGroup];

  // 5. Calculate Cutoff Statistics
  const eligibleScores = eligibleGroup.map((e) => e.compositeScore);
  const highestScore = eligibleScores.length > 0 ? Math.max(...eligibleScores) : 0;
  const lowestScore = eligibleScores.length > 0 ? Math.min(...eligibleScores) : 0;

  const categories = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Management'];
  const categoryCutoffs = categories.map((cat) => {
    const inCat = finalEntries.filter((e) => e.category === cat);
    const eligibleInCat = inCat.filter((e) => e.eligibilityStatus !== 'Ineligible');
    const scores = eligibleInCat.map((e) => e.compositeScore);
    return {
      category: cat,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      totalApplicants: inCat.length,
      eligibleApplicants: eligibleInCat.length
    };
  });

  const totalEligible = eligibleGroup.filter((e) => e.eligibilityStatus === 'Eligible').length;
  const totalPendingDocs = eligibleGroup.filter((e) => e.eligibilityStatus === 'Eligible (Pending Documents)').length;
  const totalIneligible = ineligibleGroup.length;

  // 6. Version management: Draft update or new version
  const existingDraft = await MeritList.findOne({
    programme: programmeId,
    academicSession: sessionName,
    status: 'Draft'
  });

  // Determine the current round from the latest published or draft list
  const latestPublished = await MeritList.findOne({
    programme: programmeId,
    academicSession: sessionName,
    status: { $in: ['Published', 'Archived'] }
  }).sort({ version: -1 });

  let meritListDoc;
  if (existingDraft) {
    existingDraft.entries = finalEntries;
    existingDraft.configurationSnapshot = config.toObject ? config.toObject() : config;
    existingDraft.cutoffs = {
      highestScore,
      lowestShortlistedScore: lowestScore,
      categoryCutoffs,
      totalEligible,
      totalIneligible,
      totalPendingDocs
    };
    meritListDoc = await existingDraft.save();
  } else {
    const latestVersion = await MeritList.countDocuments({
      programme: programmeId,
      academicSession: sessionName
    });

    // Determine round number: increment if there's a published list
    const currentRound = latestPublished ? (latestPublished.round || 1) + 1 : 1;
    const roundLabels = { 1: 'Round 1', 2: 'Round 2', 3: 'Final Round' };
    const roundLabel = roundLabels[currentRound] || `Round ${currentRound}`;

    meritListDoc = await MeritList.create({
      programme: programmeId,
      academicSession: sessionName,
      meritConfiguration: config._id || null,
      configurationSnapshot: config.toObject ? config.toObject() : config,
      version: latestVersion + 1,
      round: currentRound,
      roundLabel: roundLabel,
      status: 'Draft',
      entries: finalEntries,
      cutoffs: {
        highestScore,
        lowestShortlistedScore: lowestScore,
        categoryCutoffs,
        totalEligible,
        totalIneligible,
        totalPendingDocs
      }
    });
  }

  const populated = await MeritList.findById(meritListDoc._id).populate(
    'programme',
    'programmeName programmeCode department degree seatCapacity'
  );

  return populated;
}

/**
 * Publish a merit list, archiving previous published versions.
 */
async function publishMeritList(meritListId, adminId) {
  if (!mongoose.Types.ObjectId.isValid(meritListId)) {
    throw new AppError('Invalid merit list ID format.', 400);
  }

  const meritList = await MeritList.findById(meritListId);
  if (!meritList) {
    throw new AppError('Merit list not found.', 404);
  }

  if (meritList.status === 'Published') {
    throw new AppError('This merit list is already published.', 400);
  }

  if (meritList.status === 'Archived') {
    throw new AppError('Cannot publish an archived merit list. Generate a new draft instead.', 400);
  }

  // Validate that the draft has eligible entries
  const eligibleCount = (meritList.entries || []).filter(
    (e) => e.eligibilityStatus !== 'Ineligible'
  ).length;

  if (eligibleCount === 0) {
    throw new AppError('Cannot publish a merit list with no eligible candidates.', 400);
  }

  // Archive any previously published list for this programme & session
  await MeritList.updateMany(
    {
      programme: meritList.programme,
      academicSession: meritList.academicSession,
      status: 'Published',
      _id: { $ne: meritList._id }
    },
    { $set: { status: 'Archived' } }
  );

  meritList.status = 'Published';
  meritList.publishedAt = new Date();
  meritList.publishedBy = adminId;
  await meritList.save();

  // Re-query with populate for consistent response (matches generateMeritList pattern)
  const published = await MeritList.findById(meritList._id).populate(
    'programme',
    'programmeName programmeCode department degree seatCapacity'
  );

  return published;
}

/**
 * List merit lists matching filter criteria.
 */
async function getMeritLists({ programmeId, academicSession, status } = {}) {
  const query = {};
  if (programmeId) {
    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
      throw new AppError('Invalid programme ID format.', 400);
    }
    query.programme = programmeId;
  }
  if (academicSession) {
    query.academicSession = academicSession;
  }
  if (status) {
    query.status = status;
  }

  return await MeritList.find(query)
    .populate('programme', 'programmeName programmeCode department degree')
    .sort({ createdAt: -1 });
}

/**
 * Retrieve merit list by ID.
 */
async function getMeritListById(meritListId) {
  if (!mongoose.Types.ObjectId.isValid(meritListId)) {
    throw new AppError('Invalid merit list ID format.', 400);
  }
  const list = await MeritList.findById(meritListId)
    .populate('programme', 'programmeName programmeCode department degree seatCapacity')
    .populate('publishedBy', 'firstName lastName email');
  if (!list) {
    throw new AppError('Merit list not found.', 404);
  }
  return list;
}

/**
 * Generate Category-Wise Seat Allocation based on published merit ranking.
 */
async function generateSeatAllocation({
  programmeId,
  academicSession,
  meritListId,
  unfilledSeatRule = 'Keep Vacant',
  adminId
}) {
  if (!mongoose.Types.ObjectId.isValid(programmeId)) {
    throw new AppError('Invalid programme ID format.', 400);
  }

  const programme = await Programme.findById(programmeId);
  if (!programme) {
    throw new AppError('Academic programme not found.', 404);
  }

  const sessionName = academicSession ? academicSession.trim() : '2026-2027';

  // 1. Resolve Merit List
  let meritList;
  if (meritListId && mongoose.Types.ObjectId.isValid(meritListId)) {
    meritList = await MeritList.findById(meritListId);
  } else {
    meritList = await MeritList.findOne({
      programme: programmeId,
      academicSession: sessionName,
      status: 'Published'
    });
    if (!meritList) {
      meritList = await MeritList.findOne({
        programme: programmeId,
        academicSession: sessionName
      }).sort({ createdAt: -1 });
    }
  }

  if (!meritList || !Array.isArray(meritList.entries) || meritList.entries.length === 0) {
    throw new AppError('A valid generated merit list is required to compute seat allocation.', 400);
  }

  // 2. Resolve Programme Capacity & Category Quotas
  const seatConfig = programme.seatCapacity || { total: 60, categoryAllocations: [] };
  const totalCapacity = seatConfig.total || 0;

  const quotas = {
    General: 0,
    OBC: 0,
    SC: 0,
    ST: 0,
    EWS: 0,
    Management: 0
  };

  if (Array.isArray(seatConfig.categoryAllocations)) {
    for (const alloc of seatConfig.categoryAllocations) {
      if (quotas[alloc.category] !== undefined) {
        quotas[alloc.category] = Number(alloc.seats) || 0;
      }
    }
  }

  // 3. Execute Allocation Algorithm
  // Eligible applicants sorted by overall merit rank
  const eligibleApplicants = meritList.entries
    .filter((e) => e.eligibilityStatus !== 'Ineligible')
    .sort((a, b) => a.meritRank - b.meritRank);

  const allocatedMap = new Map();
  const allocationItems = [];
  let seatNumberSequence = 1;

  const allocatedCategoryCounts = {
    General: 0,
    OBC: 0,
    SC: 0,
    ST: 0,
    EWS: 0,
    Management: 0
  };

  // Step A: Open / General Merit Quota
  // Top candidates regardless of origin category are allocated Open/General seats
  for (const candidate of eligibleApplicants) {
    if (allocatedCategoryCounts.General < quotas.General) {
      allocatedCategoryCounts.General++;
      allocatedMap.set(candidate.application.toString(), true);
      allocationItems.push({
        application: candidate.application,
        applicant: candidate.applicant,
        applicationId: candidate.applicationId,
        candidateName: candidate.candidateName,
        meritRank: candidate.meritRank,
        categoryRank: candidate.categoryRank,
        appliedCategory: candidate.category,
        allocatedCategory: 'General',
        compositeScore: candidate.compositeScore,
        allocationStatus: 'Allocated',
        allocationReason: `Allocated under Open / General Merit Quota (Merit Rank #${candidate.meritRank})`,
        seatNumber: seatNumberSequence++
      });
    }
  }

  // Step B: Reserved Category Quota
  // Remaining candidates are allocated under their respective categories
  const categoriesToProcess = ['OBC', 'SC', 'ST', 'EWS', 'Management'];
  for (const cat of categoriesToProcess) {
    const quota = quotas[cat] || 0;
    const catCandidates = eligibleApplicants.filter(
      (c) => c.category === cat && !allocatedMap.has(c.application.toString())
    );

    for (const candidate of catCandidates) {
      if (allocatedCategoryCounts[cat] < quota) {
        allocatedCategoryCounts[cat]++;
        allocatedMap.set(candidate.application.toString(), true);
        allocationItems.push({
          application: candidate.application,
          applicant: candidate.applicant,
          applicationId: candidate.applicationId,
          candidateName: candidate.candidateName,
          meritRank: candidate.meritRank,
          categoryRank: candidate.categoryRank,
          appliedCategory: candidate.category,
          allocatedCategory: cat,
          compositeScore: candidate.compositeScore,
          allocationStatus: 'Allocated',
          allocationReason: `Allocated under ${cat} Category Quota (Category Rank #${candidate.categoryRank})`,
          seatNumber: seatNumberSequence++
        });
      }
    }
  }

  // Step C: Unfilled Seats Handling (if configured to convert to General)
  if (unfilledSeatRule === 'Convert to General') {
    let vacantReservedSeats = 0;
    for (const cat of categoriesToProcess) {
      vacantReservedSeats += (quotas[cat] || 0) - allocatedCategoryCounts[cat];
    }

    if (vacantReservedSeats > 0) {
      const remainingCandidates = eligibleApplicants.filter(
        (c) => !allocatedMap.has(c.application.toString())
      );

      for (const candidate of remainingCandidates) {
        if (vacantReservedSeats > 0) {
          vacantReservedSeats--;
          allocatedCategoryCounts.General++;
          allocatedMap.set(candidate.application.toString(), true);
          allocationItems.push({
            application: candidate.application,
            applicant: candidate.applicant,
            applicationId: candidate.applicationId,
            candidateName: candidate.candidateName,
            meritRank: candidate.meritRank,
            categoryRank: candidate.categoryRank,
            appliedCategory: candidate.category,
            allocatedCategory: 'General (Converted)',
            compositeScore: candidate.compositeScore,
            allocationStatus: 'Allocated',
            allocationReason: `Allocated under Converted Unfilled Quota (Merit Rank #${candidate.meritRank})`,
            seatNumber: seatNumberSequence++
          });
        }
      }
    }
  }

  // Step D: Remaining eligible applicants are Waitlisted
  for (const candidate of eligibleApplicants) {
    if (!allocatedMap.has(candidate.application.toString())) {
      allocationItems.push({
        application: candidate.application,
        applicant: candidate.applicant,
        applicationId: candidate.applicationId,
        candidateName: candidate.candidateName,
        meritRank: candidate.meritRank,
        categoryRank: candidate.categoryRank,
        appliedCategory: candidate.category,
        allocatedCategory: 'None',
        compositeScore: candidate.compositeScore,
        allocationStatus: 'Waitlisted',
        allocationReason: `Waitlisted — ${candidate.category} quota exhausted.`,
        seatNumber: null
      });
    }
  }

  // Step E: Ineligible applicants
  const ineligibleApplicants = meritList.entries.filter(
    (e) => e.eligibilityStatus === 'Ineligible'
  );
  for (const candidate of ineligibleApplicants) {
    allocationItems.push({
      application: candidate.application,
      applicant: candidate.applicant,
      applicationId: candidate.applicationId,
      candidateName: candidate.candidateName,
      meritRank: candidate.meritRank,
      categoryRank: candidate.categoryRank,
      appliedCategory: candidate.category,
      allocatedCategory: 'None',
      compositeScore: candidate.compositeScore,
      allocationStatus: 'Ineligible',
      allocationReason: candidate.eligibilityRemarks || 'Applicant does not meet programme eligibility criteria.',
      seatNumber: null
    });
  }

  // Calculate totals and category summary
  const totalAllocated = Object.values(allocatedCategoryCounts).reduce((sum, n) => sum + n, 0);
  const remainingTotal = Math.max(0, totalCapacity - totalAllocated);

  const allCategories = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Management'];
  const categorySummary = allCategories.map((cat) => {
    const total = quotas[cat] || 0;
    const allocated = allocatedCategoryCounts[cat] || 0;
    return {
      category: cat,
      totalSeats: total,
      allocatedSeats: allocated,
      remainingSeats: Math.max(0, total - allocated)
    };
  });

  // 4. Save Seat Allocation Draft
  const existingDraft = await SeatAllocation.findOne({
    programme: programmeId,
    academicSession: sessionName,
    status: 'Draft'
  });

  let allocationDoc;
  if (existingDraft) {
    existingDraft.meritList = meritList._id;
    existingDraft.totalSeats = totalCapacity;
    existingDraft.allocatedSeats = totalAllocated;
    existingDraft.remainingSeats = remainingTotal;
    existingDraft.unfilledSeatRule = unfilledSeatRule;
    existingDraft.categorySummary = categorySummary;
    existingDraft.allocations = allocationItems;
    existingDraft.history.push({
      action: 'Generated',
      performedBy: adminId,
      timestamp: new Date(),
      remarks: `Allocation recalculated with ${totalAllocated} allocated seats.`
    });
    allocationDoc = await existingDraft.save();
  } else {
    const latestVersion = await SeatAllocation.countDocuments({
      programme: programmeId,
      academicSession: sessionName
    });

    allocationDoc = await SeatAllocation.create({
      programme: programmeId,
      academicSession: sessionName,
      meritList: meritList._id,
      version: latestVersion + 1,
      status: 'Draft',
      totalSeats: totalCapacity,
      allocatedSeats: totalAllocated,
      remainingSeats: remainingTotal,
      unfilledSeatRule,
      categorySummary,
      allocations: allocationItems,
      history: [
        {
          action: 'Generated',
          performedBy: adminId,
          timestamp: new Date(),
          remarks: `Initial draft seat allocation generated (${totalAllocated} allocated / ${totalCapacity} capacity).`
        }
      ]
    });
  }

  const populated = await SeatAllocation.findById(allocationDoc._id).populate(
    'programme',
    'programmeName programmeCode department degree seatCapacity'
  );

  return populated;
}

/**
 * Approve a draft seat allocation.
 */
async function approveSeatAllocation(allocationId, adminId, remarks = '') {
  if (!mongoose.Types.ObjectId.isValid(allocationId)) {
    throw new AppError('Invalid seat allocation ID format.', 400);
  }

  const allocation = await SeatAllocation.findById(allocationId);
  if (!allocation) {
    throw new AppError('Seat allocation record not found.', 404);
  }

  allocation.status = 'Approved';
  allocation.approvedBy = adminId;
  allocation.approvedAt = new Date();
  allocation.history.push({
    action: 'Approved',
    performedBy: adminId,
    timestamp: new Date(),
    remarks: remarks ? remarks.trim() : 'Seat allocation approved by administrator.'
  });

  await allocation.save();
  return allocation.populate('programme', 'programmeName programmeCode department degree');
}

/**
 * Publish approved seat allocation results.
 */
async function publishSeatAllocation(allocationId, adminId, remarks = '') {
  if (!mongoose.Types.ObjectId.isValid(allocationId)) {
    throw new AppError('Invalid seat allocation ID format.', 400);
  }

  const allocation = await SeatAllocation.findById(allocationId);
  if (!allocation) {
    throw new AppError('Seat allocation record not found.', 404);
  }

  // Archive any previously published allocation for this programme/session
  await SeatAllocation.updateMany(
    {
      programme: allocation.programme,
      academicSession: allocation.academicSession,
      status: 'Published',
      _id: { $ne: allocation._id }
    },
    { $set: { status: 'Archived' } }
  );

  allocation.status = 'Published';
  allocation.publishedBy = adminId;
  allocation.publishedAt = new Date();
  allocation.history.push({
    action: 'Published',
    performedBy: adminId,
    timestamp: new Date(),
    remarks: remarks ? remarks.trim() : 'Allocation published to applicant portal.'
  });

  await allocation.save();
  return allocation.populate('programme', 'programmeName programmeCode department degree');
}

/**
 * List seat allocations matching filter criteria.
 */
async function getSeatAllocations({ programmeId, academicSession, status } = {}) {
  const query = {};
  if (programmeId) {
    if (!mongoose.Types.ObjectId.isValid(programmeId)) {
      throw new AppError('Invalid programme ID format.', 400);
    }
    query.programme = programmeId;
  }
  if (academicSession) {
    query.academicSession = academicSession;
  }
  if (status) {
    query.status = status;
  }

  return await SeatAllocation.find(query)
    .populate('programme', 'programmeName programmeCode department degree seatCapacity')
    .sort({ createdAt: -1 });
}

/**
 * Retrieve seat allocation by ID.
 */
async function getSeatAllocationById(allocationId) {
  if (!mongoose.Types.ObjectId.isValid(allocationId)) {
    throw new AppError('Invalid allocation ID format.', 400);
  }
  const allocation = await SeatAllocation.findById(allocationId)
    .populate('programme', 'programmeName programmeCode department degree seatCapacity')
    .populate('approvedBy', 'firstName lastName email')
    .populate('publishedBy', 'firstName lastName email');
  if (!allocation) {
    throw new AppError('Seat allocation not found.', 404);
  }
  return allocation;
}

/**
 * Retrieve published merit & allocation result for the authenticated applicant.
 */
async function getApplicantPublishedResult(applicantId) {
  const application = await Application.findOne({ applicant: applicantId }).populate(
    'selectedProgramme'
  );

  if (!application || !application.selectedProgramme) {
    return { hasPublishedResult: false };
  }

  const programmeId = application.selectedProgramme._id;
  const sessionName = application.academicSession;

  // Check for published merit list (fall back to most recent archived if no active published)
  let publishedMerit = await MeritList.findOne({
    programme: programmeId,
    academicSession: sessionName,
    status: 'Published'
  });

  if (!publishedMerit) {
    // Applicant may be enrolled from a now-archived/superseded merit list
    publishedMerit = await MeritList.findOne({
      programme: programmeId,
      academicSession: sessionName,
      status: 'Archived'
    }).sort({ publishedAt: -1 });
  }

  if (!publishedMerit) {
    return { hasPublishedResult: false };
  }

  const meritEntry = publishedMerit.entries.find(
    (e) => e.application.toString() === application._id.toString()
  );

  if (!meritEntry) {
    return { hasPublishedResult: false };
  }

  // Check for published seat allocation
  const publishedAllocation = await SeatAllocation.findOne({
    programme: programmeId,
    academicSession: sessionName,
    status: 'Published'
  });

  let allocationEntry = null;
  if (publishedAllocation) {
    allocationEntry = publishedAllocation.allocations.find(
      (a) => a.application.toString() === application._id.toString()
    );
  }

  // Category cutoff
  const catCutoff = publishedMerit.cutoffs?.categoryCutoffs?.find(
    (c) => c.category === meritEntry.category
  );

  return {
    hasPublishedResult: true,
    programme: {
      _id: application.selectedProgramme._id,
      programmeName: application.selectedProgramme.programmeName,
      programmeCode: application.selectedProgramme.programmeCode,
      degree: application.selectedProgramme.degree,
      department: application.selectedProgramme.department
    },
    academicSession: sessionName,
    candidateName: meritEntry.candidateName,
    applicationId: application.applicationId,
    category: meritEntry.category,
    class12Percentage: meritEntry.class12Percentage,
    rawEntranceScore: meritEntry.rawEntranceScore,
    compositeScore: meritEntry.compositeScore,
    meritRank: meritEntry.meritRank,
    categoryRank: meritEntry.categoryRank,
    eligibilityStatus: meritEntry.eligibilityStatus,
    eligibilityRemarks: meritEntry.eligibilityRemarks,
    allocationStatus: allocationEntry ? allocationEntry.allocationStatus : 'Pending Allocation',
    allocatedCategory: allocationEntry ? allocationEntry.allocatedCategory : null,
    allocationReason: allocationEntry ? allocationEntry.allocationReason : 'Seat allocation has not been published yet.',
    seatNumber: allocationEntry ? allocationEntry.seatNumber : null,
    cutoffs: {
      highestScore: publishedMerit.cutoffs?.highestScore || 0,
      lowestShortlistedScore: publishedMerit.cutoffs?.lowestShortlistedScore || 0,
      categoryHighest: catCutoff?.highestScore || 0,
      categoryLowest: catCutoff?.lowestScore || 0
    }
  };
}

/**
 * Retrieve the official published merit list for the authenticated applicant's programme & session.
 * Enforces privacy:
 * - Only Published (or relevant Archived) lists are returned (never Drafts)
 * - Excludes private candidate details (no phone, email, address, DOB, uploaded docs, config internals)
 * - Masks other applicants' application IDs except the requester's
 * - Includes rank, category rank, candidateName, masked application ID, category, compositeScore, eligibilityStatus, allocationStatus
 */
async function getApplicantPublishedMeritList(applicantId) {
  const application = await Application.findOne({ applicant: applicantId }).populate(
    'selectedProgramme'
  );

  if (!application || !application.selectedProgramme) {
    return { hasPublishedList: false, message: 'No admission application found.' };
  }

  const programmeId = application.selectedProgramme._id;
  const sessionName = application.academicSession;

  // Retrieve published merit list for this programme and session
  let meritList = await MeritList.findOne({
    programme: programmeId,
    academicSession: sessionName,
    status: 'Published'
  })
    .populate('programme', 'programmeName programmeCode department degree')
    .sort({ version: -1 });

  if (!meritList) {
    // Check if there is an archived list where the applicant was included
    meritList = await MeritList.findOne({
      programme: programmeId,
      academicSession: sessionName,
      status: 'Archived',
      'entries.application': application._id
    })
      .populate('programme', 'programmeName programmeCode department degree')
      .sort({ version: -1 });
  }

  if (!meritList) {
    return {
      hasPublishedList: false,
      message: 'No merit list has been published for your programme and academic session yet.'
    };
  }

  // Also check if seat allocation is published to enrich candidate allocation status
  const publishedAllocation = await SeatAllocation.findOne({
    programme: programmeId,
    academicSession: sessionName,
    status: 'Published'
  });

  const allocationMap = new Map();
  if (publishedAllocation && publishedAllocation.allocations) {
    for (const alloc of publishedAllocation.allocations) {
      allocationMap.set(alloc.application.toString(), alloc);
    }
  }

  // Format and sanitize entries
  const currentAppId = application._id.toString();
  const sanitizedEntries = (meritList.entries || []).map((entry) => {
    const isSelf = entry.application.toString() === currentAppId;
    const alloc = allocationMap.get(entry.application.toString());

    // Mask application IDs of other candidates: IEM-YYYY-XX***
    let maskedAppId = entry.applicationId;
    if (!isSelf && maskedAppId && maskedAppId.length > 8) {
      maskedAppId = maskedAppId.slice(0, -3) + '***';
    }

    return {
      _id: entry._id,
      meritRank: entry.meritRank,
      categoryRank: entry.categoryRank,
      candidateName: entry.candidateName,
      applicationId: maskedAppId,
      category: entry.category,
      class12Percentage: isSelf ? entry.class12Percentage : undefined,
      rawEntranceScore: isSelf ? entry.rawEntranceScore : undefined,
      compositeScore: entry.compositeScore,
      eligibilityStatus: entry.eligibilityStatus,
      allocationStatus: alloc ? alloc.allocationStatus : 'Pending',
      allocatedCategory: alloc ? alloc.allocatedCategory : null,
      seatNumber: isSelf && alloc ? alloc.seatNumber : undefined,
      isSelf
    };
  });

  // Find applicant's own entry
  const myEntry = sanitizedEntries.find((e) => e.isSelf) || null;

  return {
    hasPublishedList: true,
    programme: {
      _id: meritList.programme._id,
      programmeName: meritList.programme.programmeName,
      programmeCode: meritList.programme.programmeCode,
      department: meritList.programme.department,
      degree: meritList.programme.degree
    },
    academicSession: meritList.academicSession,
    version: meritList.version,
    round: meritList.round || 1,
    roundLabel: meritList.roundLabel || 'Round 1',
    status: meritList.status,
    publishedAt: meritList.publishedAt,
    cutoffs: meritList.cutoffs || null,
    myEntry,
    entries: sanitizedEntries
  };
}

module.exports = {
  saveMeritConfiguration,
  getMeritConfiguration,
  normalizeEntranceScore,
  screenEligibility,
  compareApplicants,
  generateMeritList,
  publishMeritList,
  getMeritLists,
  getMeritListById,
  generateSeatAllocation,
  approveSeatAllocation,
  publishSeatAllocation,
  getSeatAllocations,
  getSeatAllocationById,
  getApplicantPublishedResult,
  getApplicantPublishedMeritList
};
