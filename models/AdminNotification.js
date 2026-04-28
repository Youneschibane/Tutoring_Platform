const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['NEW_TEACHER', 'NEW_MODULE_DIPLOMA', 'SECURITY', 'INFO']
  },
  
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  
  }
});

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
