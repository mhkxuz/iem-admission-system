const express = require('express');
const router = express.Router();
const feeController = require('../controllers/fee.controller');

// Public Fee Routes
router.get('/programme/:programmeId', feeController.getPublicFeeByProgramme);

module.exports = router;
