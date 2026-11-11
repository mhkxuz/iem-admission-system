const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { connectDB, disconnectDB } = require('../config/db');
const { User } = require('../models');

async function seedReviewer({ closeConnection = false } = {}) {
  const reviewerEmail = process.env.REVIEWER_EMAIL || 'reviewer@iem.edu';
  const reviewerPassword = process.env.REVIEWER_PASSWORD || 'ReviewerPassword@123';
  const reviewerName = process.env.REVIEWER_NAME || 'IEM Document Reviewer';
  const reviewerPhone = process.env.REVIEWER_PHONE || '9876543201';

  console.log('=======================================================');
  console.log('  IEM Admission System — Document Reviewer Seed Script');
  console.log('=======================================================');
  console.log(`Target Email: ${reviewerEmail}`);

  try {
    await connectDB();

    const existingUser = await User.findOne({ email: reviewerEmail });
    if (existingUser) {
      if (existingUser.role !== 'reviewer') {
        existingUser.role = 'reviewer';
        await existingUser.save();
        console.log(`[Seed Success] User '${reviewerEmail}' updated to role 'reviewer'.`);
      } else {
        console.log(`[Seed Info] Reviewer account '${reviewerEmail}' already exists.`);
      }
    } else {
      const newReviewer = await User.create({
        fullName: reviewerName,
        email: reviewerEmail,
        password: reviewerPassword,
        role: 'reviewer',
        phone: reviewerPhone
      });
      console.log(`[Seed Success] Reviewer account created successfully:`);
      console.log(`  ID:    ${newReviewer._id}`);
      console.log(`  Name:  ${newReviewer.fullName}`);
      console.log(`  Email: ${newReviewer.email}`);
      console.log(`  Role:  ${newReviewer.role}`);
    }
  } catch (error) {
    console.error('[Seed Error] Failed to seed reviewer:', error.message);
    process.exitCode = 1;
  } finally {
    if (closeConnection || require.main === module) {
      await disconnectDB();
      console.log('[Seed Done] Database connection closed.');
    }
  }
}

if (require.main === module) {
  seedReviewer({ closeConnection: true });
}

module.exports = seedReviewer;
