const AppError = require('../utils/app-error');

const VALID_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Biotechnology'
];

const VALID_CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Management'];
const VALID_GENDERS = ['Male', 'Female', 'Other'];

/**
 * Validates admission application submission payload.
 */
function validateApplicationSubmission(req, res, next) {
  const { personalInfo, academicInfo, admissionInfo, academicSession } = req.body;
  const errors = [];

  if (!personalInfo || typeof personalInfo !== 'object') {
    return next(new AppError('Personal information section is required.', 400));
  }
  if (!academicInfo || typeof academicInfo !== 'object') {
    return next(new AppError('Academic information section is required.', 400));
  }
  if (!admissionInfo || typeof admissionInfo !== 'object') {
    return next(new AppError('Admission choice information section is required.', 400));
  }

  // --- 1. Personal Information Validation ---
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pinRegex = /^\d{6}$/;

  if (!personalInfo.fullName || typeof personalInfo.fullName !== 'string' || personalInfo.fullName.trim().length < 2) {
    errors.push('Full name is required (at least 2 characters)');
  }
  if (!personalInfo.dob || isNaN(new Date(personalInfo.dob).getTime())) {
    errors.push('A valid date of birth is required');
  } else {
    const dobDate = new Date(personalInfo.dob);
    const now = new Date();
    if (dobDate >= now) {
      errors.push('Date of birth must be in the past');
    }
  }
  if (!personalInfo.gender || !VALID_GENDERS.includes(personalInfo.gender)) {
    errors.push(`Gender must be one of: ${VALID_GENDERS.join(', ')}`);
  }
  if (!personalInfo.email || !emailRegex.test(personalInfo.email.trim())) {
    errors.push('A valid personal contact email is required');
  }
  if (!personalInfo.phone || typeof personalInfo.phone !== 'string' || personalInfo.phone.trim().length < 10) {
    errors.push('A valid 10-digit phone number is required');
  }
  if (!personalInfo.address || personalInfo.address.trim().length < 5) {
    errors.push('Residential address is required (at least 5 characters)');
  }
  if (!personalInfo.state || personalInfo.state.trim().length === 0) {
    errors.push('State is required');
  }
  if (!personalInfo.city || personalInfo.city.trim().length === 0) {
    errors.push('City is required');
  }
  if (!personalInfo.pincode || !pinRegex.test(personalInfo.pincode.toString().trim())) {
    errors.push('PIN code must be a 6-digit number');
  }

  // --- 2. Academic Information Validation ---
  if (!academicInfo.class10Board || academicInfo.class10Board.trim().length === 0) {
    errors.push('Class 10 board name is required');
  }
  const c10Pct = Number(academicInfo.class10Percentage);
  if (isNaN(c10Pct) || c10Pct < 0 || c10Pct > 100) {
    errors.push('Class 10 percentage must be a number between 0 and 100');
  }
  if (!academicInfo.class12Board || academicInfo.class12Board.trim().length === 0) {
    errors.push('Class 12 board name is required');
  }
  const c12Pct = Number(academicInfo.class12Percentage);
  if (isNaN(c12Pct) || c12Pct < 0 || c12Pct > 100) {
    errors.push('Class 12 percentage must be a number between 0 and 100');
  }
  const passYear = Number(academicInfo.class12PassingYear);
  if (isNaN(passYear) || passYear < 2000 || passYear > 2030) {
    errors.push('Class 12 passing year must be between 2000 and 2030');
  }

  // --- Entrance Exam & Structured Result Type ---
  let entranceExamName = academicInfo.entranceExamName ? academicInfo.entranceExamName.trim() : '';
  let entranceExamScore = academicInfo.entranceExamScore != null ? academicInfo.entranceExamScore.toString().trim() : '';
  let entranceResultType = academicInfo.entranceResultType || null;
  let entranceNumericScore = academicInfo.entranceNumericScore != null && academicInfo.entranceNumericScore !== ''
    ? Number(academicInfo.entranceNumericScore)
    : null;

  // Infer result type and numeric score if string score was passed without explicit structured fields
  if (entranceExamScore && (entranceNumericScore == null || isNaN(entranceNumericScore))) {
    if (!entranceResultType) {
      if (/rank/i.test(entranceExamScore)) entranceResultType = 'Rank';
      else if (/percentile|%ile/i.test(entranceExamScore)) entranceResultType = 'Percentile';
      else if (/score|marks/i.test(entranceExamScore)) entranceResultType = 'Score';
    }
    const numMatch = entranceExamScore.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (numMatch) {
      entranceNumericScore = parseFloat(numMatch[0]);
    }
  }

  // If structured fields are provided, validate ranges and ensure score string is formatted
  if (entranceResultType) {
    if (!['Rank', 'Percentile', 'Score'].includes(entranceResultType)) {
      errors.push('Entrance result type must be one of: Rank, Percentile, Score');
    } else if (entranceNumericScore != null && !isNaN(entranceNumericScore)) {
      if (entranceResultType === 'Rank') {
        if (!Number.isInteger(entranceNumericScore) || entranceNumericScore < 1) {
          errors.push('Entrance rank must be a positive integer greater than or equal to 1');
        }
      } else if (entranceResultType === 'Percentile') {
        if (entranceNumericScore < 0 || entranceNumericScore > 100) {
          errors.push('Entrance percentile must be between 0.00 and 100.00');
        }
      } else if (entranceResultType === 'Score') {
        if (entranceNumericScore < 0) {
          errors.push('Entrance score cannot be negative');
        }
      }
      if (!entranceExamScore) {
        entranceExamScore = entranceResultType === 'Rank'
          ? `Rank ${entranceNumericScore}`
          : entranceResultType === 'Percentile'
          ? `${entranceNumericScore} %ile`
          : `${entranceNumericScore} Marks`;
      }
    }
  }

  // Entrance examination requirement: mandatory for generic applications, optional if non-entrance programme
  const hasEntrance = Boolean(entranceExamName && entranceExamName !== 'None' && entranceExamName !== 'N/A');
  if (!hasEntrance) {
    if (!req.body.selectedProgramme) {
      errors.push('Entrance examination name is required (e.g. WBJEE, JEE Main)');
    }
  } else {
    if (!entranceExamScore && (entranceNumericScore == null || isNaN(entranceNumericScore))) {
      errors.push('Entrance examination rank or score is required');
    }
  }

  // --- 3. Admission Information Validation ---
  const dept = admissionInfo.preferredDepartment;
  const isDeptProvided = dept !== undefined && dept !== null && dept !== '' && dept !== 'N/A';

  if (isDeptProvided) {
    if (!VALID_DEPARTMENTS.includes(dept)) {
      errors.push(`Preferred department must be one of: ${VALID_DEPARTMENTS.join(', ')}`);
    }
  } else {
    // If not provided, it's allowed only when a programme is selected
    if (!req.body.selectedProgramme) {
      errors.push(`Preferred department must be one of: ${VALID_DEPARTMENTS.join(', ')}`);
    }
  }

  if (!admissionInfo.admissionCategory || !VALID_CATEGORIES.includes(admissionInfo.admissionCategory)) {
    errors.push(`Admission category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  // Clean and sanitize payload:
  // Never trust privileged fields sent from client
  req.sanitizedApplication = {
    academicSession: academicSession && typeof academicSession === 'string' ? academicSession.trim() : '2026-2027',
    selectedProgramme: req.body.selectedProgramme && typeof req.body.selectedProgramme === 'string'
      ? req.body.selectedProgramme.trim()
      : undefined,
    personalInfo: {
      fullName: personalInfo.fullName.trim(),
      dob: new Date(personalInfo.dob),
      gender: personalInfo.gender,
      email: personalInfo.email.trim().toLowerCase(),
      phone: personalInfo.phone.trim(),
      address: personalInfo.address.trim(),
      state: personalInfo.state.trim(),
      city: personalInfo.city.trim(),
      pincode: personalInfo.pincode.toString().trim()
    },
    academicInfo: {
      class10Board: academicInfo.class10Board.trim(),
      class10Percentage: c10Pct,
      class12Board: academicInfo.class12Board.trim(),
      class12Percentage: c12Pct,
      class12PassingYear: passYear,
      entranceExamName: entranceExamName,
      entranceExamScore: entranceExamScore,
      entranceResultType: entranceResultType || null,
      entranceNumericScore: entranceNumericScore != null && !isNaN(entranceNumericScore) ? entranceNumericScore : null,
      academicStream: academicInfo.academicStream && typeof academicInfo.academicStream === 'string'
        ? academicInfo.academicStream.trim()
        : ''
    },
    admissionInfo: {
      preferredDepartment: isDeptProvided ? dept : null,
      admissionCategory: admissionInfo.admissionCategory
    }
  };

  next();
}

module.exports = {
  validateApplicationSubmission,
  VALID_DEPARTMENTS,
  VALID_CATEGORIES
};
