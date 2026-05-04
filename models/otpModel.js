const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  // identifier can be an email or phone; purpose distinguishes the action
  identifier: { type: String, required: true },
  purpose: { 
    type: String, 
    required: true, 
    enum: ['signup', 'reset', 'password_change', 'profile_change', 'account_deletion'] 
  },
  otp: { type: String, required: true },
  attempts: { type: Number, default: 0, max: 5 },
  // auto-expire after 10 minutes
  createdAt: { type: Date, default: Date.now, expires: 600 }
});

otpSchema.index({ identifier: 1, purpose: 1 }, { unique: true });

module.exports = mongoose.model('Otp', otpSchema);