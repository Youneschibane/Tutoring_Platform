const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
  },
  type: {
    type: String,
    required: true,
    enum: ['new_device_login', 'info', 'security']
  },
  message: {
    type: String,
    required: true,
  },
  relatedDeviceToken: {
    type: String,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  createdAt: { type: Date, default: Date.now, expires: 600 }
});

module.exports = mongoose.model('Notification', notificationSchema);
