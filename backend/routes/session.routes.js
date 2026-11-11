const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');

// Public route to retrieve currently active admission session
router.get('/active', sessionController.getActiveSession);

module.exports = router;
