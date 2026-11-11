const path = require('path');
const documentService = require('../services/document.service');
const ApiResponse = require('../utils/api-response');

/**
 * Handle document file upload
 */
async function upload(req, res, next) {
  try {
    const docRecord = await documentService.uploadDocument({
      applicantId: req.userId,
      applicationId: req.body.applicationId,
      documentType: req.body.documentType,
      file: req.file
    });

    return ApiResponse.success(
      res,
      'Document uploaded successfully.',
      docRecord,
      201
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Stream document for inline viewing in browser
 */
async function viewDocument(req, res, next) {
  try {
    const { document, absolutePath } = await documentService.getDocumentForAccess(
      req.params.id,
      req.user
    );

    const safeFilename = path.basename(document.originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');

    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `inline; filename="${safeFilename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'"
    });

    return res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
}

/**
 * Prompt document download
 */
async function downloadDocument(req, res, next) {
  try {
    const { document, absolutePath } = await documentService.getDocumentForAccess(
      req.params.id,
      req.user
    );

    const safeFilename = path.basename(document.originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');

    res.set({
      'Content-Type': document.mimeType,
      'X-Content-Type-Options': 'nosniff'
    });

    return res.download(absolutePath, safeFilename);
  } catch (error) {
    next(error);
  }
}

/**
 * List all documents associated with an application
 */
async function getByApplication(req, res, next) {
  try {
    const documents = await documentService.getDocumentsByApplication(
      req.params.applicationId,
      req.user
    );

    return ApiResponse.success(
      res,
      'Documents retrieved successfully.',
      documents,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Verify or reject an uploaded document
 */
async function verifyDocument(req, res, next) {
  try {
    const updatedDoc = await documentService.verifyDocument({
      documentId: req.params.id,
      status: req.body.status,
      remarks: req.body.remarks,
      reviewerId: req.user._id
    });

    return ApiResponse.success(
      res,
      `Document has been successfully marked as ${updatedDoc.verificationStatus}.`,
      updatedDoc,
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve review queue of documents for inspection
 */
async function getReviewQueue(req, res, next) {
  try {
    const result = await documentService.getReviewQueue({
      status: req.query.status,
      search: req.query.search,
      documentType: req.query.documentType,
      page: req.query.page,
      limit: req.query.limit
    });

    return ApiResponse.success(
      res,
      'Review queue retrieved successfully.',
      result.documents,
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve verification audit history for a document
 */
async function getVerificationHistory(req, res, next) {
  try {
    const history = await documentService.getDocumentVerificationHistory(
      req.params.id,
      req.user
    );

    return ApiResponse.success(
      res,
      'Document verification history retrieved successfully.',
      history,
      200
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  upload,
  viewDocument,
  downloadDocument,
  getByApplication,
  verifyDocument,
  getReviewQueue,
  getVerificationHistory
};
