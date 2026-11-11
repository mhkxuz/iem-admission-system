const User = require('./user.model');
const Application = require('./application.model');
const UploadedDocument = require('./uploaded-document.model');
const ApplicationStatusHistory = require('./application-status-history.model');
const AcademicSession = require('./academic-session.model');
const Programme = require('./programme.model');
const FeeStructure = require('./fee-structure.model');
const DocumentVerificationHistory = require('./document-verification-history.model');
const MeritConfiguration = require('./merit-configuration.model');
const MeritList = require('./merit-list.model');
const SeatAllocation = require('./seat-allocation.model');
const Payment = require('./payment.model');
const Enrolment = require('./enrolment.model');
const Notification = require('./notification.model');

module.exports = {
  User,
  Application,
  UploadedDocument,
  ApplicationStatusHistory,
  AcademicSession,
  Programme,
  FeeStructure,
  DocumentVerificationHistory,
  MeritConfiguration,
  MeritList,
  SeatAllocation,
  Payment,
  Enrolment,
  Notification
};
