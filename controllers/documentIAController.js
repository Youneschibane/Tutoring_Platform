const Teacher = require('../models/teacherModel');
const User = require('../models/userModel');
const Notification = require('../models/notificationModel');
const DocumentIA = require('../models/documentIAModel');
const { extractTextFromRemoteDocument } = require('../utils/textExtractor');
const { classifyDocument, generateDocumentAnalysis, CLASSIFICATION_PROMPT, ANALYSIS_PROMPT } = require('../utils/claudeService');

const notifyTeacher = async (userId, message) => {
  if (!userId) return;
  try {
    await Notification.create({
      userId,
      type: 'info',
      message,
      isRead: false
    });
  } catch (error) {
    console.error('Notification teacher failed:', error.message);
  }
};

const safeText = (text) => {
  if (!text) return '';
  return text.length > 9000 ? `${text.slice(0, 9000)}\n\n[TRONQUÉ]` : text;
};

exports.createLivingDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: "Aucun fichier reçu. Utiliser le champ 'living_document' ou 'document'."
      });
    }

    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre })
      .select('id_enseignant firstname familyname');

    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: "Profil enseignant introuvable." });
    }

    const document = await DocumentIA.create({
      teacher: teacher._id,
      teacherId: teacher.id_enseignant,
      user: req.user._id,
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: req.file.path,
        publicId: req.file.filename,
        resourceType: req.file.resource_type || (req.file.mimetype.startsWith('image/') ? 'image' : 'raw'),
        folder: req.file.folder || 'tutoring_platform/living_documents',
        uploadedAt: new Date()
      },
      metadata: {
        title: req.body.title?.trim() || null,
        description: req.body.description?.trim() || null
      },
      status: 'pending',
      requestedAt: new Date()
    });

    res.status(202).json({
      status: 'accepted',
      message: 'Document reçu. L’analyse IA démarre en tâche de fond et un message vous sera envoyé une fois terminée.',
      data: {
        id: document.id_document_ia,
        documentIAId: document._id,
        status: document.status
      }
    });

    setImmediate(() => {
      exports.processLivingDocument(document._id).catch((err) => {
        console.error('Traitement en arrière-plan échoué pour DocumentIA:', err.message);
      });
    });
  } catch (error) {
    console.error('createLivingDocument error:', error);
    return res.status(500).json({
      status: 'error',
      message: "Impossible de créer la tâche d'analyse IA.",
      details: error.message
    });
  }
};

exports.getLivingDocumentStatus = async (req, res) => {
  try {
    const document = await DocumentIA.findOne({
      _id: req.params.id,
      user: req.user._id
    }).select('-audit.classificationPrompt -audit.generationPrompt -audit.classificationResponse -audit.generationResponse');

    if (!document) {
      return res.status(404).json({ status: 'fail', message: 'Document IA introuvable.' });
    }

    return res.status(200).json({ status: 'success', data: document });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Impossible de récupérer le statut du document IA.', details: error.message });
  }
};

exports.listLivingDocuments = async (req, res) => {
  try {
    const documents = await DocumentIA.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ status: 'success', total: documents.length, data: documents });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Impossible de récupérer les documents IA.', details: error.message });
  }
};

exports.processLivingDocument = async (documentId) => {
  const document = await DocumentIA.findById(documentId).populate('teacher', 'firstname familyname id_enseignant');

  if (!document) {
    throw new Error('Document IA introuvable pour traitement.');
  }

  if (document.status !== 'pending') {
    return document;
  }

  document.status = 'processing';
  document.startedAt = new Date();
  await document.save();

  try {
    const extractedText = await extractTextFromRemoteDocument(document.file.url, document.file.mimeType);
    const truncatedText = safeText(extractedText);
    document.extractedText = extractedText;

    const classificationResult = await classifyDocument(truncatedText, {
      originalName: document.file.originalName,
      mimeType: document.file.mimeType,
      teacherName: `${document.teacher.firstname || 'Enseignant'} ${document.teacher.familyname || ''}`.trim()
    });

    document.classification = {
      category: classificationResult.category || null,
      subjects: Array.isArray(classificationResult.subjects) ? classificationResult.subjects : [],
      gradeLevel: classificationResult.gradeLevel || null,
      language: classificationResult.language || null,
      safety: classificationResult.safety || null,
      summary: classificationResult.summary || null
    };

    const analysisResult = await generateDocumentAnalysis(truncatedText, document.classification, {
      originalName: document.file.originalName,
      mimeType: document.file.mimeType,
      teacherName: `${document.teacher.firstname || 'Enseignant'} ${document.teacher.familyname || ''}`.trim()
    });

    document.analysis = {
      suggestedTitle: analysisResult.suggestedTitle || null,
      summary: analysisResult.summary || null,
      keywords: Array.isArray(analysisResult.keywords) ? analysisResult.keywords : [],
      recommendedSubjects: Array.isArray(analysisResult.recommendedSubjects) ? analysisResult.recommendedSubjects : [],
      recommendedUse: analysisResult.recommendedUse || null,
      safetyNotes: analysisResult.safetyNotes || null,
      language: analysisResult.language || document.classification.language || null,
      documentType: analysisResult.documentType || document.classification.category || null
    };

    document.audit = {
      classificationPrompt: CLASSIFICATION_PROMPT,
      generationPrompt: ANALYSIS_PROMPT,
      classificationResponse: classificationResult.raw || null,
      generationResponse: analysisResult.raw || null
    };

    document.status = 'completed';
    document.completedAt = new Date();
    await document.save();

    const teacherUser = await User.findById(document.user).select('_id');
    await notifyTeacher(teacherUser?._id, `Votre document « ${document.file.originalName} » a été analysé avec succès. Consultez les résultats dans votre espace.`);

    return document;
  } catch (error) {
    document.status = 'failed';
    document.completedAt = new Date();
    document.error = {
      message: error.message,
      stack: error.stack ? error.stack.substring(0, 1000) : null
    };
    await document.save();

    await notifyTeacher(document.user, `Le traitement IA de votre document « ${document.file.originalName} » a échoué. Veuillez réessayer ultérieurement.`);
    throw error;
  }
};
