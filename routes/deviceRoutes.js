const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { revokeOtherDevices } = require('../controllers/deviceController');

// Revoke all other devices except current one
router.delete('/revoke-other-devices', protect, revokeOtherDevices);

module.exports = router;