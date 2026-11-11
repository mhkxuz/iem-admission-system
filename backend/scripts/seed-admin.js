const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { connectDB, disconnectDB } = require('../config/db');
const { User } = require('../models');

async function seedAdmin({ closeConnection = false } = {}) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@iem.edu';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword@123';
  const adminName = process.env.ADMIN_NAME || 'IEM Admissions Administrator';
  const adminPhone = process.env.ADMIN_PHONE || '9876543200';

  console.log('=======================================================');
  console.log('  IEM Admission System — Administrator Seed Script');
  console.log('=======================================================');
  console.log(`Target Email: ${adminEmail}`);

  try {
    await connectDB();

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log(`[Seed Success] User '${adminEmail}' updated to role 'admin'.`);
      } else {
        console.log(`[Seed Info] Administrator account '${adminEmail}' already exists.`);
      }
    } else {
      const newAdmin = await User.create({
        fullName: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        phone: adminPhone
      });
      console.log(`[Seed Success] Administrator account created successfully:`);
      console.log(`  ID:    ${newAdmin._id}`);
      console.log(`  Name:  ${newAdmin.fullName}`);
      console.log(`  Email: ${newAdmin.email}`);
      console.log(`  Role:  ${newAdmin.role}`);
    }
  } catch (error) {
    console.error('[Seed Error] Failed to seed administrator:', error.message);
    process.exitCode = 1;
  } finally {
    if (closeConnection || require.main === module) {
      await disconnectDB();
      console.log('[Seed Done] Database connection closed.');
    }
  }
}

if (require.main === module) {
  seedAdmin({ closeConnection: true });
}

module.exports = seedAdmin;
