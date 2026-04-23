const express = require('express');
const router = express.Router();

const {protect , restrictTo } = require('../middleware/authMiddleware');
const { revokeOtherDevices , deviceToken } = require('../controllers/deviceController');

// Revoke all other devices except current one
router.delete('/revoke-other-devices', protect ,revokeOtherDevices);

router.post('/register-push', protect, deviceToken
);

module.exports = router;