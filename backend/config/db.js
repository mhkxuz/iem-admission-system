const mongoose = require('mongoose');
const config = require('./config');

let memoryServerInstance = null;

/**
 * Connect to MongoDB.
 * mongodb-memory-server is used strictly for automated testing (NODE_ENV === 'test').
 * Normal development and production connect strictly to the persistent MongoDB database.
 */
async function connectDB(customUri = null) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Automated test environment uses MongoMemoryServer
  if (config.nodeEnv === 'test') {
    if (customUri) {
      await mongoose.connect(customUri);
      return mongoose.connection;
    }
    const { MongoMemoryServer } = require('mongodb-memory-server');
    if (!memoryServerInstance) {
      memoryServerInstance = await MongoMemoryServer.create();
    }
    const testUri = memoryServerInstance.getUri();
    await mongoose.connect(testUri);
    return mongoose.connection;
  }

  // Development & Production environments: Strictly persistent MongoDB
  const targetUri = customUri || config.mongoUri;
  try {
    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[Database] Connected to persistent MongoDB at: ${targetUri}`);
    return mongoose.connection;
  } catch (err) {
    console.error(`[Database Error] Could not connect to persistent MongoDB at ${targetUri}.`);
    console.error(`Please ensure a persistent MongoDB database is running (e.g., 'npm run db:start' or system mongod service).`);
    throw err;
  }
}

/**
 * Disconnect from MongoDB and clean up testing memory server if active.
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
    memoryServerInstance = null;
  }
}

module.exports = {
  connectDB,
  disconnectDB
};
