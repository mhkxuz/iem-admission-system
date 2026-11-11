const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { User } = require('../models');
const AppError = require('../utils/app-error');

/**
 * Authentication Middleware: Validates Bearer JWT in Authorization header
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('Authentication required. Please provide a valid Bearer token.', 401)
      );
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your authentication token has expired. Please log in again.', 401));
      }
      return next(new AppError('Invalid authentication token.', 401));
    }

    // Confirm user still exists in database
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(
        new AppError('The user associated with this token no longer exists.', 401)
      );
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;
