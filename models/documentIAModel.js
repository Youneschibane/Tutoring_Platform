const mongoose = require('mongoose');
const Counter = require('./counterModel');

const documentIASchema = new mongoose.Schema({
  id_document_ia: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },

  teacherId: {
    type: Number,
    required: true,
    index: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  file: {
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, required: true },
    folder: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },

  metadata: {
    title: { type: String, default: null },
    description: { type: String, default: null }
  },

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },

  requestedAt: {
    type: Date,
    default: Date.now
  },

  startedAt: {
    type: Date,
    default: null
  },

  completedAt: {
    type: Date,
    default: null
  },

  extractedText: {
    type: String,
    default: null
  },

  classification: {
    category: { type: String, default: null },
    subjects: [{ type: String }],
    gradeLevel: { type: String, default: null },
    language: { type: String, default: null },
    safety: { type: String, default: null },
    summary: { type: String, default: null }
  },

  analysis: {
    suggestedTitle: { type: String, default: null },
    summary: { type: String, default: null },
    keywords: [{ type: String }],
    recommendedSubjects: [{ type: String }],
    recommendedUse: { type: String, default: null },
    safetyNotes: { type: String, default: null },
    language: { type: String, default: null },
    documentType: { type: String, default: null }
  },

  audit: {
    classificationPrompt: { type: String, default: null },
    generationPrompt: { type: String, default: null },
    classificationResponse: { type: String, default: null },
    generationResponse: { type: String, default: null }
  },

  error: {
    message: { type: String, default: null },
    stack: { type: String, default: null }
  }
}, {
  timestamps: true
});

// Auto-increment id_document_ia using the counter collection
documentIASchema.pre('validate', async function (next) {
  if (!this.isNew || this.id_document_ia) return next();

  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'documentIA' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    this.id_document_ia = counter.seq;
    next();
  } catch (error) {
    next(error);
  }
});

documentIASchema.index({ teacher: 1, status: 1 });

module.exports = mongoose.model('DocumentIA', documentIASchema);
