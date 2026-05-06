const Service = require('../models/serviceModel');
const User    = require('../models/userModel');
const { sendEmail } = require('../utils/sendEmail');

// ─────────────────────────────────────────────────────────────
// Suspendre un service
// ─────────────────────────────────────────────────────────────
exports.suspendreService = async (req, res) => {
  try {
    const { id_service } = req.params;
    

  

    const service = await Service.findOne({ id_service: Number(id_service) });
    if (!service) {
      return res.status(404).json({ status: 'fail', message: "Service introuvable." });
    }

    if (service.isDeleted) {
      return res.status(400).json({ status: 'fail', message: "Ce service a déjà été supprimé." });
    }

    if (service.suspendu) {
      return res.status(400).json({ status: 'fail', message: "Ce service est déjà suspendu." });
    }

    const updatedService = await Service.findOneAndUpdate(
      { id_service: Number(id_service) },
      {
        suspendu:         true,
        suspendedAt:      new Date(),
        suspendedBy:      req.user._id,
        
        actif:            false   // désactiver aussi le service
      },
      { returnDocument: "after" }
    );

    // Notifier le teacher — fire and forget
    (async () => {
      try {
        const teacher = await User.findOne({ idmembre: service.id_enseignant });
        if (teacher?.email) {
          await sendEmail({
            email:   teacher.email,
            subject: "⚠️ Votre service a été suspendu",
            message: `Votre service "${service.nom_service}" a été suspendu par l'administration.\n\nVeuillez contacter le support pour plus d'informations.`
          });
        }
      } catch (e) {
        console.error('Email notification error:', e.message);
      }
    })();

    return res.status(200).json({
      status:  'success',
      message: "Service suspendu avec succès.",
      data:    updatedService
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Réactiver un service suspendu
// ─────────────────────────────────────────────────────────────
exports.reactiverService = async (req, res) => {
  try {
    const { id_service } = req.params;

    const service = await Service.findOne({ id_service: Number(id_service) });
    if (!service) {
      return res.status(404).json({ status: 'fail', message: "Service introuvable." });
    }

    if (service.isDeleted) {
      return res.status(400).json({ status: 'fail', message: "Ce service a été supprimé et ne peut pas être réactivé." });
    }

    if (!service.suspendu) {
      return res.status(400).json({ status: 'fail', message: "Ce service n'est pas suspendu." });
    }

    const updatedService = await Service.findOneAndUpdate(
      { id_service: Number(id_service) },
      {
        suspendu:         false,
        suspendedAt:      null,
        suspendedBy:      null,
        suspensionReason: null,
        actif:            true
      },
      { returnDocument: "after" }
    );

    // Notifier le teacher — fire and forget
    (async () => {
      try {
        const teacher = await User.findOne({ idmembre: service.id_enseignant });
        if (teacher?.email) {
          await sendEmail({
            email:   teacher.email,
            subject: "✅ Votre service a été réactivé",
            message: `Votre service "${service.nom_service}" a été réactivé par l'administration. Il est maintenant visible aux étudiants.`
          });
        }
      } catch (e) {
        console.error('Email notification error:', e.message);
      }
    })();

    return res.status(200).json({
      status:  'success',
      message: "Service réactivé avec succès.",
      data:    updatedService
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Supprimer un service (soft delete)
// ─────────────────────────────────────────────────────────────
exports.supprimerService = async (req, res) => {
  try {
    const { id_service } = req.params;
   


    const service = await Service.findOne({ id_service: Number(id_service) });
    if (!service) {
      return res.status(404).json({ status: 'fail', message: "Service introuvable." });
    }

    if (service.isDeleted) {
      return res.status(400).json({ status: 'fail', message: "Ce service est déjà supprimé." });
    }

    await Service.findOneAndUpdate(
      { id_service: Number(id_service) },
      {
        isDeleted: true,
        actif:     false,
        suspendu:  false
      }
    );

    // Notifier le teacher — fire and forget
    (async () => {
      try {
        const teacher = await User.findOne({ idmembre: service.id_enseignant });
        if (teacher?.email) {
          await sendEmail({
            email:   teacher.email,
            subject: "❌ Votre service a été supprimé",
            message: `Votre service "${service.nom_service}" a été supprimé par l'administration.\n\nVeuillez contacter le support pour plus d'informations.`
          });
        }
      } catch (e) {
        console.error('Email notification error:', e.message);
      }
    })();

    return res.status(200).json({
      status:  'success',
      message: "Service supprimé avec succès."
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Lister tous les services (admin — avec filtre statut)
// ─────────────────────────────────────────────────────────────
exports.getAllServices = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const { statut } = req.query;

    const query = {};

    switch (statut) {
      case 'actif':
        query.isDeleted = false;
        query.actif = true;
        break;

      case 'suspendu':
        query.isDeleted = false;
        query.suspendu = true;
        break;

      case 'supprime':
        query.isDeleted = true;
        break;

      case undefined:
      case 'all':
        break;

      default:
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid statut filter'
        });
    }

    // ── 🔥 OPTIMIZED DB CALLS ─────────────────────────

    const [services, total] = await Promise.all([
      Service.find(query, {
        __v: 0,
        // only keep needed fields (IMPORTANT)
        name: 1,
        description: 1,
        date_creation: 1,
        suspendedBy: 1,
        createdBy: 1,
        actif: 1,
        suspendu: 1,
        isDeleted: 1
      })
        .populate({
          path: 'suspendedBy',
          select: 'firstname familyname'
        })
        .populate({
          path: 'createdBy',
          select: 'firstname familyname'
        })
        .sort({ date_creation: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // 👈 EARLY lean for speed

      Service.countDocuments(query)
    ]);

    return res.status(200).json({
      status: 'success',
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      data: services
    });

  } catch (error) {
    console.error('getAllServices error:', error);

    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
