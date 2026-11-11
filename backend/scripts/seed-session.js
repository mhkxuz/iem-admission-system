const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { connectDB, disconnectDB } = require('../config/db');
const { ensureDefaultSession } = require('../services/session.service');

async function seedSession({ closeConnection = false } = {}) {
  console.log('=======================================================');
  console.log('  IEM Admission System — Session Seed Script');
  console.log('=======================================================');

  try {
    await connectDB();
    const session = await ensureDefaultSession();
    console.log(`[Seed Success] Admission Session verified / created:`);
    console.log(`  ID:     ${session._id}`);
    console.log(`  Name:   ${session.sessionName}`);
    console.log(`  Code:   ${session.sessionCode}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  Active: ${session.isActive}`);
  } catch (error) {
    console.error('[Seed Error] Failed to seed admission session:', error.message);
    process.exitCode = 1;
  } finally {
    if (closeConnection || require.main === module) {
      await disconnectDB();
      console.log('[Seed Done] Database connection closed.');
    }
  }
}

if (require.main === module) {
  seedSession({ closeConnection: true });
}

module.exports = seedSession;
