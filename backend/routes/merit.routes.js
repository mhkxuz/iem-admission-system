const express = require('express');
const router = express.Router();
const meritController = require('../controllers/merit.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireAdmin, requireApplicant } = require('../middleware/role.middleware');

// Applicant: View personal published merit rank & seat allocation result
router.get('/my-result', authenticate, requireApplicant, meritController.getMyMeritResult);
router.get('/published-list', authenticate, requireApplicant, meritController.getApplicantPublishedList);

// Administrative routes: Strictly protected (Authenticated + Admin role required)
router.post('/configuration', authenticate, requireAdmin, meritController.saveConfiguration);
router.get('/configuration', authenticate, requireAdmin, meritController.getConfiguration);

router.post('/generate', authenticate, requireAdmin, meritController.generateMeritList);
router.get('/lists', authenticate, requireAdmin, meritController.getMeritLists);
router.get('/lists/:id', authenticate, requireAdmin, meritController.getMeritListById);
router.post('/lists/:id/publish', authenticate, requireAdmin, meritController.publishMeritList);

router.post('/allocation/generate', authenticate, requireAdmin, meritController.generateSeatAllocation);
router.get('/allocation', authenticate, requireAdmin, meritController.getSeatAllocations);
router.get('/allocation/:id', authenticate, requireAdmin, meritController.getSeatAllocationById);
router.post('/allocation/:id/approve', authenticate, requireAdmin, meritController.approveSeatAllocation);
router.post('/allocation/:id/publish', authenticate, requireAdmin, meritController.publishSeatAllocation);

module.exports = router;
