const ApiResponse = require('../utils/api-response');

/**
 * Centralized Express Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values(err.errors).map(val => val.message);
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for parameter: ${err.path}`;
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedKeys = Object.keys(err.keyValue || {});
    message = `Duplicate value entered for field(s): ${duplicatedKeys.join(', ')}`;
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Handle Multer Errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed file size limit';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    console.error('[Error Details]', err);
  }

  // Never expose internal exception details or stack-related messages for
  // unexpected server errors. Operational 4xx messages remain descriptive.
  if (statusCode >= 500) {
    message = 'Internal Server Error';
    errors = null;
  }

  return ApiResponse.error(res, message, statusCode, errors);
}

module.exports = errorHandler;
