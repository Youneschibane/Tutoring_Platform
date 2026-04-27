const Teacher = require('../models/teacherModel');
const cloudinary = require('../Config/Cloudinaryconfig · JS');

/**
 * @desc    Ajouter un diplôme au profil
 * @route   POST /api/teacher/diplomes
 * @access  Private (Teacher only)
 */
exports.ajouterDiplome = async (req, res) => {
  let uploadedPublicId = null;

  try {
    // ─────────────────────────────
    // 1. Vérification fichier
    // ─────────────────────────────
    
    if (!req.file) {
      return res.status(400).json({
        status: "fail",
        message: "Aucun fichier reçu. Champ attendu: 'diplome'"
      });
    }

    // ─────────────────────────────
    // 2. Récupération Cloudinary
    // ─────────────────────────────
    uploadedPublicId = req.file.filename; // public_id Cloudinary
    const fileUrl = req.file.path;        // URL Cloudinary

    // ─────────────────────────────
    // 3. Trouver le teacher
    // ─────────────────────────────
    const teacher = await Teacher.findOne({
      id_enseignant: req.user.idmembre
    });

    if (!teacher) {
      // rollback cloudinary
      if (uploadedPublicId) {
        await cloudinary.uploader.destroy(uploadedPublicId);
      }

      return res.status(404).json({
        status: "fail",
        message: "Profil enseignant introuvable"
      });
    }
    
    console.log(req.body.nom?.trim()|| "Diplôme sans titre");
    // ─────────────────────────────
    // 4. Construire diplôme
    // ─────────────────────────────
    const newDiplome = {
      url: fileUrl,
      publicId: uploadedPublicId,
      nom: req.body.nom?.trim() || "Diplôme sans titre",
      uploadedAt: new Date()
    };

    // ─────────────────────────────
    // 5. Sauvegarde DB
    // ─────────────────────────────
    teacher.documents.diplomes.push(newDiplome);
    await teacher.save();

    const addedDiplome =
      teacher.documents.diplomes[teacher.documents.diplomes.length - 1];

    // ─────────────────────────────
    // 6. Response
    // ─────────────────────────────
    return res.status(201).json({
      status: "success",
      message: "Diplôme ajouté avec succès",
      data: addedDiplome
    });

  } catch (error) {
    // ─────────────────────────────
    // 7. rollback Cloudinary
    // ─────────────────────────────
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (err) {
        console.error("Cloudinary cleanup error:", err.message);
      }
    }

    return res.status(500).json({
      status: "error",
      message: "Erreur lors de l'ajout du diplôme",
      details: error.message
    });
  }
};

/**
 * @desc    Supprimer un diplôme (Cloudinary + DB)
 * @route   DELETE /api/teacher/diplomes/:diplome_id
 * @access  Private (Teacher only)
 */
exports.supprimerDiplome = async (req, res) => {
  try {
    const { diplome_id } = req.params;

    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre });
    if (!teacher) {
      return res.status(404).json({
        status: 'fail',
        message: "Profil enseignant introuvable."
      });
    }

    // Trouver le diplôme dans le sous-tableau via son _id
    const diplome = teacher.documents.diplomes.id(diplome_id);
    if (!diplome) {
      return res.status(404).json({
        status: 'fail',
        message: "Le diplôme spécifié n'existe pas."
      });
    }

    // 1. Supprimer le fichier physiquement de Cloudinary
    if (diplome.publicId) {
      try {
        await cloudinary.uploader.destroy(diplome.publicId);
      } catch (e) {
        console.warn("Avertissement : Impossible de supprimer sur Cloudinary, suppression DB continue.");
      }
    }

    // 2. Supprimer l'élément du tableau Mongoose
    teacher.documents.diplomes.pull(diplome_id);
    await teacher.save();

    return res.status(200).json({
      status: 'success',
      message: "Diplôme supprimé avec succès du profil."
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: "Erreur lors de la suppression.",
      details: error.message
    });
  }
};

/**
 * @desc    Récupérer tous les diplômes du prof connecté
 * @route   GET /api/teacher/diplomes
 * @access  Private (Teacher only)
 */
exports.getMesDiplomes = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre })
      .select('documents.diplomes');

    if (!teacher) {
      return res.status(404).json({
        status: 'fail',
        message: "Profil enseignant introuvable."
      });
    }
    
    return res.status(200).json({
      status: 'success',
      count: teacher.documents.diplomes.length,
      data: teacher.documents.diplomes
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: "Impossible de récupérer les diplômes.",
      details: error.message
    });
  }
};