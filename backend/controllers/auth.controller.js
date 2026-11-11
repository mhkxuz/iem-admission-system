const authService = require('../services/auth.service');
const ApiResponse = require('../utils/api-response');

/**
 * Handle new user registration (strictly applicant)
 */
async function register(req, res, next) {
  try {
    const result = await authService.registerUser(req.body);
    return ApiResponse.success(
      res,
      'Registration successful. Welcome to IEM Admission Portal.',
      result,
      201
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Handle user authentication
 */
async function login(req, res, next) {
  try {
    const result = await authService.loginUser(req.body);
    return ApiResponse.success(
      res,
      'Login successful.',
      result,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Handle fetching authenticated user profile
 */
async function getMe(req, res, next) {
  try {
    const profile = await authService.getProfileById(req.userId);
    return ApiResponse.success(
      res,
      'User profile retrieved successfully.',
      profile,
      200
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getMe
};
