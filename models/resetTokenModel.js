const mongoose = require('mongoose');

const ResetTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  email: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

// expire after 15 minutes
ResetTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15 * 60 });

module.exports = mongoose.model('ResetToken', ResetTokenSchema);
