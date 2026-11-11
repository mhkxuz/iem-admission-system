const express = require('express');
const router = express.Router();
const programmeController = require('../controllers/programme.controller');

// Public Programme Catalogue Routes
router.get('/', programmeController.getPublicProgrammes);
router.get('/code/:code', programmeController.getPublicProgrammeByCode);
router.get('/:id', programmeController.getPublicProgrammeById);

module.exports = router;
