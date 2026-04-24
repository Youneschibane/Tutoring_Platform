const mongoose = require('mongoose');

const accountDeletionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  email: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  deletionScheduledFor: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'cancelled', 'completed'],
    default: 'pending'
  },
  reason: {
    type: String,
    trim: true
  },
  cancelledAt: {
    type: Date
  },
  deletedAt: {
    type: Date
  }
});

// Auto-expire pending deletions after 7 days
accountDeletionSchema.index(
  { deletionScheduledFor: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('AccountDeletion', accountDeletionSchema);
