const AppError = require('../utils/app-error');

/**
 * Validates registration request payload.
 * Strictly forces applicant role regardless of what is passed in body.
 */
function validateRegister(req, res, next) {
  const { fullName, email, password, phone } = req.body;
  const errors = [];

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (phone && typeof phone === 'string' && phone.trim().length > 0) {
    const phoneClean = phone.replace(/[\s\-+()]/g, '');
    if (!/^\d{10,12}$/.test(phoneClean)) {
      errors.push('Phone number must contain between 10 and 12 digits');
    }
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  // Security: Public registration must never allow self-assigning admin role
  req.body.role = 'applicant';
  req.body.fullName = fullName.trim();
  req.body.email = email.trim().toLowerCase();
  if (phone) req.body.phone = phone.trim();

  next();
}

/**
 * Validates login request payload.
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required');
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join('. '), 400));
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

module.exports = {
  validateRegister,
  validateLogin
};
