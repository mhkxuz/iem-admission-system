const app = require('./app');
const config = require('./config/config');
const { connectDB, disconnectDB } = require('./config/db');
const sessionService = require('./services/session.service');
const programmeService = require('./services/programme.service');
const legacyMigration = require('./services/legacy-migration.service');

let server;

async function startServer() {
  try {
    await connectDB();
    await sessionService.ensureDefaultSession();
    await programmeService.ensureDefaultProgrammesAndFees();

    // Auto-migrate legacy applications created before programme seeding
    try {
      await legacyMigration.migrateLegacyApplications();
    } catch (migrationErr) {
      console.warn('[Legacy Migration] Non-fatal migration error:', migrationErr.message);
    }

    server = app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(`  IEM Online Admission System Backend API`);
      console.log(`  Environment: ${config.nodeEnv}`);
      console.log(`  Server listening on http://localhost:${config.port}`);
      console.log(`  Health Check: http://localhost:${config.port}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await disconnectDB();
      console.log('Database connection closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
