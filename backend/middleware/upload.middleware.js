const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/config');
const AppError = require('../utils/app-error');

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Permitted extensions and mime types
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/pjpeg'];

// Magic bytes signatures
const SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  jpeg: [0xff, 0xd8, 0xff],       // JPEG
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] // PNG
};

/**
 * Configure Multer Disk Storage with collision-resistant safe filenames.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `doc_${uniqueSuffix}${ext}`);
  }
});

/**
 * Initial extension and MIME filter.
 */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new AppError(
        `Invalid file extension '${ext}'. Allowed extensions are: ${ALLOWED_EXTENSIONS.join(', ')}`,
        400
      ),
      false
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    return cb(
      new AppError(
        `Invalid file MIME type '${file.mimetype}'. Only PDF and image documents are permitted.`,
        400
      ),
      false
    );
  }

  cb(null, true);
}

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize // 5MB
  }
});

/**
 * Helper to safely delete file from disk to prevent orphans.
 */
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`[Upload Error] Failed to clean up orphaned file at ${filePath}:`, err.message);
    }
  }
}

/**
 * Inspects file magic bytes on disk to confirm genuine file signature.
 */
async function verifyMagicBytes(filePath) {
  const buffer = Buffer.alloc(12);
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const { bytesRead } = await fd.read(buffer, 0, 12, 0);
    if (bytesRead < 4) {
      return { valid: false, detected: 'unknown' };
    }

    // Check PDF
    if (
      buffer[0] === SIGNATURES.pdf[0] &&
      buffer[1] === SIGNATURES.pdf[1] &&
      buffer[2] === SIGNATURES.pdf[2] &&
      buffer[3] === SIGNATURES.pdf[3]
    ) {
      return { valid: true, detected: 'application/pdf' };
    }

    // Check JPEG
    if (
      buffer[0] === SIGNATURES.jpeg[0] &&
      buffer[1] === SIGNATURES.jpeg[1] &&
      buffer[2] === SIGNATURES.jpeg[2]
    ) {
      return { valid: true, detected: 'image/jpeg' };
    }

    // Check PNG
    if (
      buffer[0] === SIGNATURES.png[0] &&
      buffer[1] === SIGNATURES.png[1] &&
      buffer[2] === SIGNATURES.png[2] &&
      buffer[3] === SIGNATURES.png[3]
    ) {
      return { valid: true, detected: 'image/png' };
    }

    return { valid: false, detected: 'unrecognized' };
  } finally {
    await fd.close();
  }
}

/**
 * Middleware wrapper handling Multer, limits, and magic byte validation.
 */
function handleDocumentUpload(fieldName = 'document') {
  const uploadSingle = multerUpload.single(fieldName);

  return (req, res, next) => {
    uploadSingle(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(
              new AppError(
                `File size exceeds the maximum permitted limit of ${Math.round(config.maxFileSize / (1024 * 1024))}MB.`,
                400
              )
            );
          }
          return next(new AppError(`Upload error: ${err.message}`, 400));
        }
        return next(err);
      }

      if (!req.file) {
        return next(new AppError('No document file was provided for upload.', 400));
      }

      // Verify actual file signature / magic bytes
      try {
        const { valid, detected } = await verifyMagicBytes(req.file.path);
        if (!valid) {
          cleanupFile(req.file.path);
          return next(
            new AppError(
              'Security verification failed: File content does not match genuine PDF or image signatures.',
              400
            )
          );
        }

        // Overwrite file mimetype with verified signature
        req.file.verifiedMimeType = detected;
        next();
      } catch (verifyErr) {
        cleanupFile(req.file.path);
        return next(new AppError('Failed to inspect and verify uploaded document.', 500));
      }
    });
  };
}

module.exports = {
  handleDocumentUpload,
  cleanupFile,
  verifyMagicBytes
};
