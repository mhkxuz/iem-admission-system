const { Application } = require('../models');
const { APPLICATION_STATUSES } = require('./status-workflow.service');

/**
 * Stage 7: MongoDB aggregation pipelines for administrative dashboard statistics.
 *
 * Every figure presented on the dashboard is produced by MongoDB itself with
 * `$match` and `$group` stages. No endpoint loads the full application
 * collection into Node.js to calculate counts.
 */

// Total applications: a $match stage keeps the pipeline explicit and allows a
// future academic-session filter to be added without restructuring the stages.
const TOTAL_APPLICATIONS_PIPELINE = Object.freeze([
  { $match: {} },
  { $group: { _id: null, count: { $sum: 1 } } }
]);

// Status distribution: one grouped bucket per stored status.
const STATUS_DISTRIBUTION_PIPELINE = Object.freeze([
  { $match: { status: { $in: APPLICATION_STATUSES } } },
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

// Department distribution: ignore documents without a usable department value.
const DEPARTMENT_DISTRIBUTION_PIPELINE = Object.freeze([
  { $match: { 'admissionInfo.preferredDepartment': { $type: 'string' } } },
  {
    $group: {
      _id: '$admissionInfo.preferredDepartment',
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1, _id: 1 } }
]);

// Category distribution: same shape as the department aggregation.
const CATEGORY_DISTRIBUTION_PIPELINE = Object.freeze([
  { $match: { 'admissionInfo.admissionCategory': { $type: 'string' } } },
  {
    $group: {
      _id: '$admissionInfo.admissionCategory',
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1, _id: 1 } }
]);

/**
 * Build the complete status list in workflow order, filling statuses that have
 * no documents with an explicit zero. This keeps the API contract stable for
 * the dashboard regardless of the stored data.
 */
function buildStatusDistribution(statusRows) {
  const countsByStatus = new Map(statusRows.map(row => [row._id, row.count]));

  return APPLICATION_STATUSES.map(status => ({
    status,
    count: countsByStatus.get(status) || 0
  }));
}

/**
 * Execute the dashboard aggregation pipelines concurrently and shape the
 * results into the dashboard response.
 */
async function getDashboardStatistics() {
  const [totalRows, statusRows, departmentRows, categoryRows] = await Promise.all([
    Application.aggregate(TOTAL_APPLICATIONS_PIPELINE),
    Application.aggregate(STATUS_DISTRIBUTION_PIPELINE),
    Application.aggregate(DEPARTMENT_DISTRIBUTION_PIPELINE),
    Application.aggregate(CATEGORY_DISTRIBUTION_PIPELINE)
  ]);

  const statusDistribution = buildStatusDistribution(statusRows);
  const statusCounts = statusDistribution.reduce((accumulator, entry) => {
    accumulator[entry.status] = entry.count;
    return accumulator;
  }, {});

  return {
    metrics: {
      totalApplications: totalRows.length > 0 ? totalRows[0].count : 0,
      submitted: statusCounts.Submitted,
      underReview: statusCounts['Under Review'],
      selected: statusCounts.Selected,
      rejected: statusCounts.Rejected
    },
    statusDistribution,
    departmentDistribution: departmentRows.map(row => ({
      department: row._id,
      count: row.count
    })),
    categoryDistribution: categoryRows.map(row => ({
      category: row._id,
      count: row.count
    }))
  };
}

module.exports = {
  TOTAL_APPLICATIONS_PIPELINE,
  STATUS_DISTRIBUTION_PIPELINE,
  DEPARTMENT_DISTRIBUTION_PIPELINE,
  CATEGORY_DISTRIBUTION_PIPELINE,
  getDashboardStatistics
};
