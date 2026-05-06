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
    // ── PAGINATION ─────────────────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    // ── PARAMS ─────────────────────────────────────────────────
    const {
      statut        = 'all',   // actif | suspendu | supprime | archive | all
      search,                    // recherche texte libre
      matiere,                   // filtre matière
      niveau,                    // filtre niveau
      type_service,              // Individuel | Groupe
      annee,                     // filtre année
      prix_min,
      prix_max,
      sort_by    = 'date_creation', // date_creation | prix | nom_service
      sort_order = 'desc',          // asc | desc
    } = req.query;

    // ── BUILD FILTER ───────────────────────────────────────────
    const query = {};

    // Statut principal
    switch (statut) {
      case 'actif':
        query.isDeleted              = false;
        query.suspendu               = false;
        query.actif                  = true;
        query['archivedMeta.isArchived'] = false;
        break;
      case 'suspendu':
        query.isDeleted = false;
        query.suspendu  = true;
        break;
      case 'supprime':
        query.isDeleted = true;
        break;
      case 'archive':
        query.isDeleted                  = false;
        query['archivedMeta.isArchived'] = true;
        break;
      case 'all':
        break; // admin only — aucun filtre
      default:
        return res.status(400).json({
          status: 'fail',
          message: `Statut invalide : "${statut}". Valeurs acceptées : actif, suspendu, supprime, archive, all`
        });
    }

    // Recherche texte (nom_service + matiere)
    if (search?.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { nom_service: regex },
        { matiere:     regex },
        { description: regex }
      ];
    }

    // Filtres optionnels
    if (matiere)      query.matiere      = new RegExp(matiere.trim(), 'i');
    if (niveau)       query.niveau_concerne = niveau;
    if (type_service) query.type_service = type_service;
    if (annee)        query.annee_concerne = annee;

    // Fourchette de prix
    if (prix_min || prix_max) {
      query.prix = {};
      if (prix_min) query.prix.$gte = parseFloat(prix_min);
      if (prix_max) query.prix.$lte = parseFloat(prix_max);
    }

    // ── SORT ───────────────────────────────────────────────────
    const ALLOWED_SORTS = ['date_creation', 'prix', 'nom_service'];
    const sortField = ALLOWED_SORTS.includes(sort_by) ? sort_by : 'date_creation';
    const sortDir   = sort_order === 'asc' ? 1 : -1;

    // ── QUERY ──────────────────────────────────────────────────
    const [services, total] = await Promise.all([
      Service.find(query)
        .select(`
          id_service id_enseignant id_enseignant_mongoose
          nom_service type_service matiere niveau_concerne
          annee_concerne description nombre_max_participants
          prix duree_seance actif suspendu isDeleted date_creation
          suspendedBy suspendedAt suspensionReason
          archivedMeta
        `)
        .populate({ path: 'id_enseignant_mongoose', select: 'firstname familyname email' })
        .populate({ path: 'suspendedBy',            select: 'firstname familyname' })
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .lean(),

      Service.countDocuments(query)
    ]);

    // ── NORMALIZE ──────────────────────────────────────────────
    // Aplatir les infos enseignant directement dans chaque service
    const data = services.map(({ id_enseignant_mongoose, suspendedBy, ...s }) => ({
      ...s,
      enseignant: id_enseignant_mongoose
        ? {
            _id:        id_enseignant_mongoose._id,
            firstname:  id_enseignant_mongoose.firstname,
            familyname: id_enseignant_mongoose.familyname,
            email:      id_enseignant_mongoose.email,
          }
        : { id_enseignant: s.id_enseignant }, // fallback si populate échoue
      suspendedBy: suspendedBy
        ? `${suspendedBy.firstname} ${suspendedBy.familyname}`
        : null,
    }));

    // ── RESPONSE ───────────────────────────────────────────────
    return res.status(200).json({
      status: 'success',
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
      filters: { statut, search, matiere, niveau, type_service, annee, prix_min, prix_max },
      data,
    });

  } catch (error) {
    console.error('[getAllServices]', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};