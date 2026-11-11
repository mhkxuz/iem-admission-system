const reportService = require('../services/report.service');
const ApiResponse = require('../utils/api-response');

/**
 * Admin: Get High-Level Overview Metrics and KPIs
 */
async function getOverview(req, res, next) {
  try {
    const result = await reportService.getOverviewAnalytics(req.query);
    return ApiResponse.success(res, 'Overview analytics retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Get Comprehensive Application Analytics
 */
async function getApplications(req, res, next) {
  try {
    const result = await reportService.getApplicationAnalytics(req.query);
    return ApiResponse.success(res, 'Application analytics retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Get Document Verification Analytics & Workload Breakdown
 */
async function getDocuments(req, res, next) {
  try {
    const result = await reportService.getDocumentAnalytics(req.query);
    return ApiResponse.success(res, 'Document verification analytics retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Get Merit and Seat Allocation Analytics
 */
async function getMerit(req, res, next) {
  try {
    const result = await reportService.getMeritAnalytics(req.query);
    return ApiResponse.success(res, 'Merit and seat allocation analytics retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Get Financial Payment and Enrolment Analytics
 */
async function getPayments(req, res, next) {
  try {
    const result = await reportService.getPaymentAnalytics(req.query);
    return ApiResponse.success(res, 'Payment and enrolment analytics retrieved successfully.', result, 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Export Administrative Report to CSV or PDF
 */
async function exportReport(req, res, next) {
  try {
    const { type } = req.params;
    const { format = 'csv', ...filters } = req.query;

    const exportData = await reportService.exportReport({
      type,
      format,
      filters
    });

    res.setHeader('Content-Type', exportData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.fileName}"`);
    return res.status(200).send(exportData.data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOverview,
  getApplications,
  getDocuments,
  getMerit,
  getPayments,
  exportReport
};
