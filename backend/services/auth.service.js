const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { User } = require('../models');
const AppError = require('../utils/app-error');

/**
 * Generate signed JWT for authenticated user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn
    }
  );
}

/**
 * Sanitize user object to guarantee no password exposure
 */
function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.__v;
  return obj;
}

/**
 * Register new applicant user
 */
async function registerUser({ fullName, email, password, phone }) {
  // Check if email already registered
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('An account with this email address already exists', 409);
  }

  // Create new applicant (role is strictly enforced)
  const newUser = await User.create({
    fullName,
    email,
    password,
    role: 'applicant',
    phone: phone || ''
  });

  const token = generateToken(newUser);
  return {
    token,
    user: sanitizeUser(newUser)
  };
}

/**
 * Authenticate user with email and password
 */
async function loginUser({ email, password }) {
  // Explicitly select password field for verification
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    // Avoid user enumeration: generic error message
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateToken(user);
  return {
    token,
    user: sanitizeUser(user)
  };
}

/**
 * Retrieve user profile by ID
 */
async function getProfileById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User profile not found', 404);
  }
  return sanitizeUser(user);
}

module.exports = {
  generateToken,
  sanitizeUser,
  registerUser,
  loginUser,
  getProfileById
};
