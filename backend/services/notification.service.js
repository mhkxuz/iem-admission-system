const { Notification, User } = require('../models');
const config = require('../config/config');

/**
 * Send transactional notification (email / in-app record).
 * Supports development/sandbox simulation and persistent audit logging in MongoDB.
 */
async function sendNotification({
  recipient,
  recipientEmail,
  type,
  title,
  message,
  metadata = {}
}) {
  let targetEmail = recipientEmail;
  if (!targetEmail && recipient) {
    const user = await User.findById(recipient).select('email');
    if (user) {
      targetEmail = user.email;
    }
  }

  // Delivery mechanism (Sandbox / Mock or SMTP)
  let deliveryStatus = 'Sent';
  try {
    if (config.nodeEnv !== 'test') {
      // In development / live without SMTP, log notification intent
      // eslint-disable-next-line no-console
      console.log(`[Notification Engine] [${type}] To: ${targetEmail} | Title: "${title}"`);
    }
  } catch (err) {
    deliveryStatus = 'Failed';
  }

  const notification = await Notification.create({
    recipient,
    recipientEmail: targetEmail || 'unknown@example.com',
    type,
    title,
    message,
    metadata,
    deliveryStatus,
    sentAt: new Date()
  });

  return notification;
}

/**
 * Retrieve notifications for a specific user
 */
async function getNotificationsForUser(userId) {
  return await Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(50);
}

module.exports = {
  sendNotification,
  getNotificationsForUser
};
