const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { UploadedDocument, Application, DocumentVerificationHistory, User } = require('../models');
const config = require('../config/config');
const AppError = require('../utils/app-error');
const { cleanupFile } = require('../middleware/upload.middleware');

const VALID_DOCUMENT_TYPES = [
  'Class 10 Marksheet',
  'Class 12 Marksheet',
  'Entrance Examination Scorecard',
  'Photograph',
  'Other Supporting Documents',
  'Other'
];

/**
 * Handle document metadata storage and application association.
 */
async function uploadDocument({ applicantId, applicationId, documentType, file }) {
  if (!file) {
    throw new AppError('File is missing from upload request.', 400);
  }

  // 1. Validate document type
  if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
    cleanupFile(file.path);
    throw new AppError(
      `Invalid document type '${documentType}'. Allowed types are: ${VALID_DOCUMENT_TYPES.join(', ')}`,
      400
    );
  }

  // 2. Validate Application existence & applicant ownership
  if (!applicationId) {
    cleanupFile(file.path);
    throw new AppError('Application ID is required to link the uploaded document.', 400);
  }

  const query = applicationId.toString().startsWith('IEM-')
    ? { applicationId }
    : { _id: applicationId };

  let application;
  try {
    application = await Application.findOne(query);
  } catch (err) {
    cleanupFile(file.path);
    throw new AppError('Invalid Application ID format.', 400);
  }

  if (!application) {
    cleanupFile(file.path);
    throw new AppError('Admission application not found.', 404);
  }

  if (application.applicant.toString() !== applicantId.toString()) {
    cleanupFile(file.path);
    throw new AppError(
      'Forbidden: You are not authorized to upload documents to another applicant\'s admission application.',
      403
    );
  }

  // 3. Create document record
  try {
    const existingRejected = await UploadedDocument.findOne({
      application: application._id,
      documentType,
      verificationStatus: 'Rejected'
    }).sort({ uploadedAt: -1 });

    const docRecord = await UploadedDocument.create({
      application: application._id,
      applicant: applicantId,
      documentType,
      originalFileName: path.basename(file.originalname).slice(0, 200),
      storedFileName: file.filename,
      filePath: path.relative(path.resolve(__dirname, '..'), file.path),
      mimeType: file.verifiedMimeType || file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date(),
      verificationStatus: 'Pending'
    });

    if (existingRejected) {
      existingRejected.replacedBy = docRecord._id;
      await existingRejected.save();
    }

    return docRecord;
  } catch (dbErr) {
    cleanupFile(file.path);
    throw dbErr;
  }
}

/**
 * Retrieve document metadata and verify access permissions with path traversal guard.
 */
async function getDocumentForAccess(documentId, user) {
  let doc;
  try {
    doc = await UploadedDocument.findById(documentId).populate('application');
  } catch (err) {
    throw new AppError('Invalid document ID format.', 400);
  }

  if (!doc) {
    throw new AppError('Document record not found.', 404);
  }

  // RBAC & Ownership check
  if (user.role === 'applicant' && doc.applicant.toString() !== user._id.toString()) {
    throw new AppError('Forbidden: You are not authorized to access another applicant\'s document.', 403);
  }

  if (!['applicant', 'admin', 'reviewer'].includes(user.role)) {
    throw new AppError('Forbidden: Access denied.', 403);
  }

  // Path traversal prevention: Resolve absolute path and verify it stays within the upload root
  const normalizedUploadDir = path.resolve(config.uploadDir);
  const absolutePath = path.resolve(normalizedUploadDir, doc.storedFileName);
  const relativePath = path.relative(normalizedUploadDir, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new AppError('Security violation: Attempted path traversal detected.', 403);
  }

  // Confirm file exists on disk
  if (!fs.existsSync(absolutePath)) {
    throw new AppError('The requested document file could not be found on server storage.', 404);
  }

  return {
    document: doc,
    absolutePath
  };
}

/**
 * Retrieve all uploaded documents for a given application.
 */
async function getDocumentsByApplication(applicationId, user) {
  const query = applicationId.toString().startsWith('IEM-')
    ? { applicationId }
    : { _id: applicationId };

  const application = await Application.findOne(query);
  if (!application) {
    throw new AppError('Admission application not found.', 404);
  }

  if (user.role === 'applicant' && application.applicant.toString() !== user._id.toString()) {
    throw new AppError('Forbidden: You are not authorized to view documents for this application.', 403);
  }

  const documents = await UploadedDocument.find({ application: application._id })
    .sort({ uploadedAt: -1 })
    .populate('verifiedBy', 'fullName email role');

  return documents;
}

/**
 * Verify or reject an uploaded document with reviewer audit trail.
 */
async function verifyDocument({ documentId, status, remarks, reviewerId }) {
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    throw new AppError('Invalid document ID format.', 400);
  }

  const VALID_STATUSES = ['Verified', 'Rejected'];
  if (!status || !VALID_STATUSES.includes(status)) {
    throw new AppError(
      `Invalid verification status '${status}'. Allowed statuses are: ${VALID_STATUSES.join(', ')}`,
      400
    );
  }

  if (status === 'Rejected' && (!remarks || !remarks.trim())) {
    throw new AppError('Remarks are mandatory when rejecting a document.', 400);
  }

  const doc = await UploadedDocument.findById(documentId);
  if (!doc) {
    throw new AppError('Document record not found.', 404);
  }

  const previousStatus = doc.verificationStatus || 'Pending';
  const cleanRemarks = remarks ? remarks.trim() : '';

  // Update document record
  doc.verificationStatus = status;
  doc.verifiedBy = reviewerId;
  doc.verificationRemarks = cleanRemarks;
  doc.verifiedAt = new Date();
  await doc.save();

  // Create append-only verification history entry
  await DocumentVerificationHistory.create({
    document: doc._id,
    application: doc.application,
    previousStatus,
    newStatus: status,
    verifiedBy: reviewerId,
    remarks: cleanRemarks,
    timestamp: new Date()
  });

  const populatedDoc = await UploadedDocument.findById(doc._id)
    .populate('verifiedBy', 'fullName email role')
    .populate('application', 'applicationId status academicSession');

  return populatedDoc;
}

/**
 * Retrieve review queue / documents with optional filtering by verification status and search.
 */
async function getReviewQueue({ status, search, documentType, page = 1, limit = 50 }) {
  const query = {};

  if (status && status !== 'all') {
    query.verificationStatus = status;
  }

  if (documentType && documentType !== 'all') {
    query.documentType = documentType;
  }

  if (search && search.trim()) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');

    const [matchingApps, matchingUsers] = await Promise.all([
      Application.find({ applicationId: regex }).select('_id'),
      User.find({
        $or: [{ fullName: regex }, { email: regex }]
      }).select('_id')
    ]);

    const appIds = matchingApps.map((a) => a._id);
    const userIds = matchingUsers.map((u) => u._id);

    query.$or = [
      { application: { $in: appIds } },
      { applicant: { $in: userIds } },
      { originalFileName: regex }
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 50);
  const skip = (pageNum - 1) * limitNum;

  const [documents, total] = await Promise.all([
    UploadedDocument.find(query)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('application', 'applicationId status academicSession admissionCategory selectedProgramme')
      .populate('applicant', 'fullName email phone')
      .populate('verifiedBy', 'fullName email role'),
    UploadedDocument.countDocuments(query)
  ]);

  return {
    documents,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1
    }
  };
}

/**
 * Retrieve verification history for a given document.
 */
async function getDocumentVerificationHistory(documentId, user) {
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    throw new AppError('Invalid document ID format.', 400);
  }

  const doc = await UploadedDocument.findById(documentId);
  if (!doc) {
    throw new AppError('Document record not found.', 404);
  }

  // RBAC & Ownership check
  if (user.role === 'applicant' && doc.applicant.toString() !== user._id.toString()) {
    throw new AppError('Forbidden: You are not authorized to access another applicant\'s document history.', 403);
  }

  const history = await DocumentVerificationHistory.find({ document: doc._id })
    .sort({ timestamp: -1, createdAt: -1 })
    .populate('verifiedBy', 'fullName email role');

  return history;
}

module.exports = {
  uploadDocument,
  getDocumentForAccess,
  getDocumentsByApplication,
  verifyDocument,
  getReviewQueue,
  getDocumentVerificationHistory,
  VALID_DOCUMENT_TYPES
};
