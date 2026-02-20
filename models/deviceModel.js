const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    deviceToken: {
        type: String,
        required: true,
        unique: true,
    },
    userAgent: {
        type: String,
        trim: true,
    },
    ipAddress: {
        type: String,
        trim: true,
    },
    deviceName: {
        type: String,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastUsed: {
        type: Date,
        default: Date.now,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;