const mongoose = require('mongoose');

const deviceOtpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  deviceToken: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: { type: Date, default: Date.now, expires: 600 }
});

module.exports = mongoose.model('DeviceOtp', deviceOtpSchema);
