const express = require('express');
const router = express.Router();

const SignUp = require('../Sign_In_Up/Sign_up');
const signIn = require('../Sign_In_Up/Sign_in');
const controller = require('../Sign_In_Up/Controller');

// Signup / Signin
router.post('/signup', SignUp);
router.post('/signin', signIn);

// Signup OTP
router.post('/signup/send-otp', controller.sendSignupOtp);
router.post('/signup/verify', controller.verifySignupOtp);

// Password reset
router.post('/password/send-reset', controller.sendResetOtp);
router.post('/password/verify', controller.verifyResetOtp);
router.post('/password/reset', controller.resetPassword);

module.exports = router;