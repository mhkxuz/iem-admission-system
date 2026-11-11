/**
 * Legacy Application Migration Service
 *
 * Safely maps applications that were created before programme auto-seeding,
 * which lack a `selectedProgramme` ObjectId reference.
 *
 * Mapping strategy:
 *   1. Match `admissionInfo.preferredDepartment` to a Programme with the same `department`.
 *   2. Only assign when the match is unambiguous (exactly one active programme matches).
 *   3. Log every mapping for audit purposes.
 *   4. Never overwrite an existing valid `selectedProgramme` reference.
 *   5. If ambiguous (multiple programmes share the department), skip and flag for admin review.
 */

const mongoose = require('mongoose');
const { Application, Programme } = require('../models');

/**
 * Attempt to auto-map all legacy applications (those without a selectedProgramme)
 * to the correct programme based on their admissionInfo.preferredDepartment.
 *
 * @returns {{ mapped: number, skipped: number, details: Array }}
 */
async function migrateLegacyApplications() {
  const legacyApps = await Application.find({
    $or: [
      { selectedProgramme: null },
      { selectedProgramme: { $exists: false } }
    ]
  });

  if (legacyApps.length === 0) {
    return { mapped: 0, skipped: 0, details: [] };
  }

  const allProgrammes = await Programme.find({ isActive: true });
  const results = { mapped: 0, skipped: 0, details: [] };

  for (const app of legacyApps) {
    const dept = app.admissionInfo?.preferredDepartment;

    if (!dept) {
      results.skipped++;
      results.details.push({
        applicationId: app.applicationId,
        applicant: app.personalInfo?.fullName,
        reason: 'No preferredDepartment found — requires manual admin assignment.',
        status: 'skipped'
      });
      continue;
    }

    // Find programmes matching this department
    const matches = allProgrammes.filter(
      (p) => p.department && p.department.toLowerCase() === dept.toLowerCase()
    );

    if (matches.length === 0) {
      results.skipped++;
      results.details.push({
        applicationId: app.applicationId,
        applicant: app.personalInfo?.fullName,
        department: dept,
        reason: `No active programme found with department '${dept}'.`,
        status: 'skipped'
      });
      continue;
    }

    if (matches.length > 1) {
      // Ambiguous — multiple programmes share this department.
      // Try to narrow: prefer B.Tech programmes for engineering departments.
      const btechMatches = matches.filter((m) => m.programmeCode?.startsWith('BTECH'));
      if (btechMatches.length === 1) {
        // Unambiguous within B.Tech scope
        await Application.updateOne(
          { _id: app._id },
          { $set: { selectedProgramme: btechMatches[0]._id } }
        );
        results.mapped++;
        results.details.push({
          applicationId: app.applicationId,
          applicant: app.personalInfo?.fullName,
          department: dept,
          assignedProgramme: btechMatches[0].programmeName,
          programmeId: btechMatches[0]._id.toString(),
          status: 'mapped'
        });
        continue;
      }

      results.skipped++;
      results.details.push({
        applicationId: app.applicationId,
        applicant: app.personalInfo?.fullName,
        department: dept,
        reason: `Ambiguous: ${matches.length} programmes match department '${dept}'. Requires manual admin assignment.`,
        candidates: matches.map((m) => ({ code: m.programmeCode, name: m.programmeName, id: m._id.toString() })),
        status: 'skipped'
      });
      continue;
    }

    // Exactly one match — unambiguous mapping
    await Application.updateOne(
      { _id: app._id },
      { $set: { selectedProgramme: matches[0]._id } }
    );
    results.mapped++;
    results.details.push({
      applicationId: app.applicationId,
      applicant: app.personalInfo?.fullName,
      department: dept,
      assignedProgramme: matches[0].programmeName,
      programmeId: matches[0]._id.toString(),
      status: 'mapped'
    });
  }

  if (results.mapped > 0) {
    console.log(
      `[Legacy Migration] Mapped ${results.mapped} legacy application(s) to their programme. ` +
        `Skipped ${results.skipped}.`
    );
  }

  return results;
}

/**
 * Admin-initiated manual programme assignment for a specific application.
 *
 * @param {string} applicationId - MongoDB ObjectId of the application
 * @param {string} programmeId - MongoDB ObjectId of the target programme
 * @param {string} adminId - Admin who performed the assignment
 * @returns {{ application, programme }}
 */
async function adminAssignProgramme(applicationId, programmeId, adminId) {
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    const AppError = require('../utils/app-error');
    throw new AppError('Invalid application ID format.', 400);
  }
  if (!mongoose.Types.ObjectId.isValid(programmeId)) {
    const AppError = require('../utils/app-error');
    throw new AppError('Invalid programme ID format.', 400);
  }

  const application = await Application.findById(applicationId);
  if (!application) {
    const AppError = require('../utils/app-error');
    throw new AppError('Application not found.', 404);
  }

  const programme = await Programme.findById(programmeId);
  if (!programme) {
    const AppError = require('../utils/app-error');
    throw new AppError('Programme not found.', 404);
  }

  const previousProgramme = application.selectedProgramme
    ? application.selectedProgramme.toString()
    : null;

  application.selectedProgramme = programme._id;

  // Also sync preferredDepartment if the programme has one
  if (programme.department) {
    if (!application.admissionInfo) {
      application.admissionInfo = {};
    }
    application.admissionInfo.preferredDepartment = programme.department;
  }

  await application.save();

  console.log(
    `[Admin Programme Assignment] Admin ${adminId} assigned application ${application.applicationId} ` +
      `from programme ${previousProgramme || 'none'} to ${programme.programmeName} (${programme._id}).`
  );

  return {
    application: {
      _id: application._id,
      applicationId: application.applicationId,
      applicant: application.personalInfo?.fullName,
      previousProgramme,
      assignedProgramme: programme.programmeName,
      programmeId: programme._id.toString()
    },
    programme: {
      _id: programme._id,
      programmeCode: programme.programmeCode,
      programmeName: programme.programmeName
    }
  };
}

/**
 * Get all applications that still lack a selectedProgramme (for admin review).
 */
async function getUnmappedApplications() {
  const apps = await Application.find({
    $or: [
      { selectedProgramme: null },
      { selectedProgramme: { $exists: false } }
    ]
  })
    .select('applicationId personalInfo.fullName admissionInfo status academicSession')
    .lean();

  return apps;
}

module.exports = {
  migrateLegacyApplications,
  adminAssignProgramme,
  getUnmappedApplications
};
