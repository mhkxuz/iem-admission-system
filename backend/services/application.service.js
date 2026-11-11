const mongoose = require('mongoose');
const { Application, ApplicationStatusHistory, AcademicSession, Programme } = require('../models');
const { ensureDefaultSession } = require('./session.service');
const AppError = require('../utils/app-error');
const { generateUniqueApplicationId } = require('../utils/id-generator');

/**
 * Submit a new admission application for the authenticated applicant.
 */
async function submitApplication(applicantId, sanitizedData) {
  // 1. Resolve active admission session
  let activeSession = await AcademicSession.findOne({ isActive: true });

  // If database contains 0 sessions (e.g. unseeded fresh deployment/test), safely ensure default '2026-2027'
  if (!activeSession && (await AcademicSession.countDocuments()) === 0) {
    activeSession = await ensureDefaultSession();
  }

  if (!activeSession) {
    throw new AppError(
      'No active admission session is currently open for submissions. Please contact the admissions office.',
      400
    );
  }

  if (activeSession.status === 'Closed') {
    throw new AppError(
      `Admission session '${activeSession.sessionName}' is closed. Submissions are no longer accepted.`,
      400
    );
  }

  const now = new Date();
  if (activeSession.applicationStartDate && now < activeSession.applicationStartDate) {
    throw new AppError(
      `Applications for academic session '${activeSession.sessionName}' have not opened yet.`,
      400
    );
  }

  if (activeSession.applicationEndDate && now > activeSession.applicationEndDate) {
    throw new AppError(
      `The application deadline for academic session '${activeSession.sessionName}' has passed.`,
      400
    );
  }

  const session = activeSession.sessionName;

  // 2. Validate selected programme if provided
  if (sanitizedData.selectedProgramme) {
    let prog;
    if (mongoose.Types.ObjectId.isValid(sanitizedData.selectedProgramme)) {
      prog = await Programme.findById(sanitizedData.selectedProgramme);
    } else {
      prog = await Programme.findOne({
        programmeCode: sanitizedData.selectedProgramme.toString().trim().toUpperCase()
      });
    }

    if (!prog) {
      throw new AppError('The selected academic programme does not exist.', 404);
    }

    if (!prog.isActive || prog.isApplicationOpen === false) {
      throw new AppError(
        `Academic programme '${prog.programmeName}' is not currently accepting applications.`,
        400
      );
    }

    sanitizedData.selectedProgramme = prog._id;

    // Harmonize preferredDepartment with the selected programme
    if (!sanitizedData.admissionInfo) {
      sanitizedData.admissionInfo = {};
    }
    const engineeringDepts = [
      'Computer Science & Engineering',
      'Information Technology',
      'Electronics & Communication Engineering',
      'Electrical Engineering',
      'Mechanical Engineering',
      'Biotechnology'
    ];
    if (prog.department && engineeringDepts.includes(prog.department)) {
      sanitizedData.admissionInfo.preferredDepartment = prog.department;
    } else {
      sanitizedData.admissionInfo.preferredDepartment =
        sanitizedData.admissionInfo.preferredDepartment || null;
    }

    // Validate programme-specific eligibility
    if (prog.eligibility) {
      if (
        prog.eligibility.minClass12Percentage != null &&
        sanitizedData.academicInfo?.class12Percentage != null
      ) {
        const candidatePercentage = Number(sanitizedData.academicInfo.class12Percentage);
        if (candidatePercentage < prog.eligibility.minClass12Percentage) {
          throw new AppError(
            `Ineligible for ${prog.programmeName}: Minimum Class 12 aggregate requirement is ${prog.eligibility.minClass12Percentage}%, but applicant has ${candidatePercentage}%.`,
            400
          );
        }
      }

      if (
        Array.isArray(prog.eligibility.acceptedAcademicStreams) &&
        prog.eligibility.acceptedAcademicStreams.length > 0 &&
        sanitizedData.academicInfo?.academicStream
      ) {
        const acceptedUpper = prog.eligibility.acceptedAcademicStreams.map((s) => s.trim().toUpperCase());
        const candidateStream = sanitizedData.academicInfo.academicStream.trim().toUpperCase();
        if (!acceptedUpper.includes(candidateStream)) {
          throw new AppError(
            `Ineligible stream: ${prog.programmeName} accepts ${prog.eligibility.acceptedAcademicStreams.join(', ')}, but applicant has '${sanitizedData.academicInfo.academicStream}'.`,
            400
          );
        }
      }
    }
  }

  // 3. Proactive duplicate check
  const existingApp = await Application.findOne({
    applicant: applicantId,
    academicSession: session
  });

  if (existingApp) {
    throw new AppError(
      `You have already submitted an admission application for academic session ${session} (Application ID: ${existingApp.applicationId}).`,
      409
    );
  }

  // 3. Generate unique Application ID (format: IEM-YYYY-XXXXX)
  const applicationId = await generateUniqueApplicationId(session);

  try {
    // 4. Atomically create application with compound uniqueness protection
    const application = await Application.create({
      ...sanitizedData,
      academicSession: session,
      applicant: applicantId,
      applicationId,
      status: 'Submitted',
      submittedAt: new Date()
    });

    // 4. Record initial submission in audit history. If the audit record cannot
    // be written, compensate by removing the just-created application so an
    // application never exists without its initial history entry.
    try {
      await ApplicationStatusHistory.create({
        application: application._id,
        previousStatus: 'Submitted',
        newStatus: 'Submitted',
        changedBy: applicantId,
        remarks: 'Application submitted by candidate'
      });
    } catch (historyError) {
      try {
        await Application.deleteOne({ _id: application._id });
      } catch (cleanupError) {
        console.error(
          '[Application Submission] Failed to roll back application after audit history failure:',
          cleanupError
        );
      }
      throw historyError;
    }

    return application;
  } catch (error) {
    // Intercept MongoDB duplicate-key race condition
    if (error.code === 11000) {
      throw new AppError(
        `An application for academic session ${session} already exists for your account. Duplicate submissions are strictly prevented.`,
        409
      );
    }
    throw error;
  }
}

/**
 * Retrieve the current applicant's application.
 */
async function getMyApplication(applicantId) {
  const application = await Application.findOne({ applicant: applicantId })
    .populate('selectedProgramme', 'programmeName programmeCode degree department duration durationUnit eligibility seatCapacity')
    .populate('documents')
    .populate({
      path: 'statusHistory',
      populate: { path: 'changedBy', select: 'fullName role' }
    });

  return application;
}

/**
 * Retrieve application by ID with strict ownership verification.
 */
async function getApplicationById(idOrAppId, user) {
  const query = idOrAppId.startsWith('IEM-')
    ? { applicationId: idOrAppId }
    : { _id: idOrAppId };

  const application = await Application.findOne(query)
    .populate('applicant', 'fullName email phone')
    .populate('selectedProgramme', 'programmeName programmeCode degree department duration durationUnit eligibility seatCapacity')
    .populate('documents')
    .populate({
      path: 'statusHistory',
      populate: { path: 'changedBy', select: 'fullName role' }
    });

  if (!application) {
    throw new AppError('Admission application not found.', 404);
  }

  // Strict RBAC & Data Isolation:
  // Applicants can ONLY access their own application.
  if (user.role === 'applicant' && application.applicant._id.toString() !== user._id.toString()) {
    throw new AppError(
      'Forbidden: You are not authorized to view another applicant\'s admission application.',
      403
    );
  }

  return application;
}

module.exports = {
  submitApplication,
  getMyApplication,
  getApplicationById
};
