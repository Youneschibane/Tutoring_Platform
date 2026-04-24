// Add these new routes to your routes file (e.g., authRoutes.js or a new packProfilRoutes.js)

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const passwordController = require('../controllers/passwordController');
const profileController = require('../packProfil/profileController');
const deletionController = require('../controllers/deletionController');

// Password Management
router.post('/password/request-otp', protect, passwordController.requestPasswordChangeOtp);
router.post('/password/confirm', protect, passwordController.confirmPasswordChange);

// Profile Updates
router.put('/profile/update', protect, upload.single('photo'), profileController.updateProfile);




// Account Deletion
router.patch('/users/:id/delete',     adminController.deleteAccount);
router.patch('/users/:id/reactivate', adminController.reactivateAccount);

// Legacy endpoints (backward compatible)
router.post('/password', protect, passwordController.updatePassword);
router.put('/profile', protect, upload.single('photo'), profileController.updateProfile);
router.post('/delete-account', protect, deletionController.deleteAccount);

module.exports = router;

/**
 * FRONTEND IMPLEMENTATION GUIDE
 * 
 * 1. UPDATE PASSWORD (2-step process):
 *    Step 1: POST /auth/password/request-otp
 *      - body: { currentPassword: "..." }
 *      - response: { status, message, contact }
 *    
 *    Step 2: POST /auth/password/confirm
 *      - body: { otp: "123456", newPassword: "..." }
 *      - response: { status, message }
 * 
 * 2. UPDATE PROFILE (2-step if sensitive fields, 1-step if not):
 *    Option A (Non-sensitive update - direct):
 *      - PUT /auth/profile/update
 *      - body: { firstname, familyname, postaladr, photo (file) }
 *      - response: { status, message, data }
 *    
 *    Option B (Sensitive fields - requires OTP):
 *      Step 1: POST /auth/profile/request-update-otp
 *        - body: { email, phone, ... }
 *        - response: { status, requiresOtp, contact }
 *      
 *      Step 2: PUT /auth/profile/update
 *        - body: { firstname, email, phone, otp: "123456", ... }
 *        - response: { status, message, data }
 * 
 * 3. DELETE ACCOUNT (3-step process):
 *    Step 1: POST /auth/account/request-deletion
 *      - body: { password: "..." }
 *      - response: { status, message, contact, deletionDate }
 *    
 *    Step 2: POST /auth/account/confirm-deletion
 *      - body: { otp: "123456" }
 *      - response: { status, message, deletionDate }
 *      - User account is deactivated for 7 days (grace period)
 *    
 *    Step 3 (optional): POST /auth/account/cancel-deletion (within 7 days)
 *      - body: {}
 *      - response: { status, message }
 * 
 * SECURITY FEATURES IMPLEMENTED:
 * ✅ OTP verification (6-digit codes, 10-minute expiry)
 * ✅ Device invalidation on password change (force re-login)
 * ✅ Sensitive field detection (email, phone)
 * ✅ 7-day grace period for account deletion
 * ✅ Account recovery within grace period
 * ✅ Activity logging and notifications
 * ✅ Transaction-based operations (all-or-nothing)
 * ✅ Audit trail via AccountDeletion model
 */
