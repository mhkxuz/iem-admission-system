const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const sessionController = require('../controllers/session.controller');
const programmeController = require('../controllers/programme.controller');
const feeController = require('../controllers/fee.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');

// Strictly protect all administrative routes: Authenticated + Admin Role
router.use(authenticate, requireAdmin);

// Dashboard metrics & recent activity
router.get('/dashboard', adminController.getDashboard);

// Applications listing with server-side filtering, searching & pagination
router.get('/applications', adminController.getApplications);

// Legacy Application Programme Mapping (must come BEFORE :id param routes)
router.get('/applications/unmapped/programmes', adminController.getUnmappedApplications);
router.post('/applications/migrate-legacy', adminController.migrateLegacyApplications);

// Detailed application inspection
router.get('/applications/:id', adminController.getApplicationById);

// Administrator-only status workflow update (Submitted -> Under Review -> Selected/Rejected)
router.patch('/applications/:id/status', adminController.updateApplicationStatus);

// Programme assignment for legacy applications
router.patch('/applications/:id/assign-programme', adminController.assignProgramme);

// Admission Sessions Management
router.post('/sessions', sessionController.createSession);
router.get('/sessions', sessionController.getAllSessions);
router.get('/sessions/:id', sessionController.getSessionById);
router.patch('/sessions/:id', sessionController.updateSession);
router.patch('/sessions/:id/activate', sessionController.activateSession);
router.patch('/sessions/:id/close', sessionController.closeSession);
router.delete('/sessions/:id', sessionController.deleteSession);

// Academic Programme Catalogue Management
router.post('/programmes', programmeController.createProgramme);
router.get('/programmes', programmeController.getAllProgrammes);
router.get('/programmes/:id', programmeController.getProgrammeById);
router.patch('/programmes/:id', programmeController.updateProgramme);
router.patch('/programmes/:id/activate', programmeController.activateProgramme);
router.patch('/programmes/:id/deactivate', programmeController.deactivateProgramme);
router.delete('/programmes/:id', programmeController.deleteProgramme);

// Fee Structure Management
router.post('/fees', feeController.createFeeStructure);
router.get('/fees', feeController.getAllFeeStructures);
router.get('/fees/:id', feeController.getFeeStructureById);
router.patch('/fees/:id', feeController.updateFeeStructure);
router.patch('/fees/:id/activate', feeController.activateFeeStructure);
router.patch('/fees/:id/deactivate', feeController.deactivateFeeStructure);
router.delete('/fees/:id', feeController.deleteFeeStructure);

// User & Reviewer Role Management
router.get('/users', adminController.getUsers);
router.post('/users/reviewer', adminController.createReviewer);
router.patch('/users/:id/role', adminController.updateUserRole);

module.exports = router;
