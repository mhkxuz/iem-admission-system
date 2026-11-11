const crypto = require('crypto');
const { Application } = require('../models');

/**
 * Generates a unique Application ID formatted as IEM-YYYY-XXXXX
 * e.g., IEM-2026-84920
 */
async function generateUniqueApplicationId(session = '2026-2027') {
  const year = session.split('-')[0] || '2026';
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate 5-digit pseudo-random numeric sequence (10000 to 99999)
    const randomNum = crypto.randomInt(10000, 99999);
    const candidateId = `IEM-${year}-${randomNum}`;

    // Verify candidate ID doesn't already exist
    const existing = await Application.findOne({ applicationId: candidateId }).select('_id');
    if (!existing) {
      return candidateId;
    }
  }

  // Fallback: 5 alphanumeric uppercase characters
  const hexSuffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `IEM-${year}-${hexSuffix}`;
}

module.exports = {
  generateUniqueApplicationId
};
