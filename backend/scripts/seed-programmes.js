/**
 * Standalone seed script for default IEM programmes and active fee structures.
 */
const { connectDB, disconnectDB } = require('../config/db');
const sessionService = require('../services/session.service');
const programmeService = require('../services/programme.service');

async function seed() {
  try {
    await connectDB();
    await sessionService.ensureDefaultSession();
    await programmeService.ensureDefaultProgrammesAndFees();
    console.log('[Seed Programmes] Default programmes and fee structures check completed successfully.');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Programmes Error]:', error);
    process.exit(1);
  }
}

seed();
