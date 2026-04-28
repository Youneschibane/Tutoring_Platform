const Evaluation = require('../models/Evaluation');
const Teacher = require('../models/teacherModel'); 
const User = require('../models/userModel'); // ← ajouter en haut du fichier

// ==========================================
// TÂCHE 1 : Laisser une évaluation (POST)
// ==========================================
exports.createReview = async (req, res) => {
    try {
        // 1. On récupère les données envoyées par le front-end
        const { 
            id_participation, 
            id_enseignant, 
            id_eleve, 
            note, 
            qualite_enseignement, 
            ponctualite, 
            carte_explication, 
            pedagogie, 
            commentaire 
        } = req.body;

        // 2. On crée la nouvelle évaluation
        const newEval = new Evaluation({
            id_evaluation: Date.now(), // Génère un ID unique basé sur l'heure (ou utilisez votre compteur)
            id_participation,
            id_enseignant,
            id_eleve,
            note,
            qualite_enseignement,
            ponctualite,
            carte_explication,
            pedagogie,
            commentaire,
            visible: true
        });

        // On sauvegarde dans la base de données
        await newEval.save();

        // 3. Mise à jour de la note moyenne de l'enseignant
const teacher = await Teacher.findOne({ id_enseignant: parseInt(id_enseignant) });
if (teacher) {
    const totalScore = (teacher.rating * teacher.reviewsCount) + note;
    const newCount = teacher.reviewsCount + 1;
    const newRating = totalScore / newCount;
    await Teacher.updateOne(
        { id_enseignant: parseInt(id_enseignant) },
        { $set: { rating: newRating, reviewsCount: newCount } }
    );
}

        // 4. On renvoie un message de succès au front-end
        res.status(201).json({ 
            success: true, 
            message: "Évaluation enregistrée avec succès.", 
            data: newEval 
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Erreur lors de la création de l'évaluation : " + error.message });
    }
};

// ==========================================
// TÂCHE 2 : Afficher les évaluations d'un enseignant (GET)
// ==========================================



exports.getTeacherReviews = async (req, res) => {
    try {
        const profId = parseInt(req.params.id_enseignant);

        const evaluations = await Evaluation.find({ id_enseignant: profId, visible: true })
            .sort({ date_evaluation: -1 });

        const teacher = await Teacher.findOne({ id_enseignant: profId }).select('rating reviewsCount');

        if (!teacher) {
            return res.status(404).json({ success: false, message: "Enseignant introuvable." });
        }

        const reviewsWithNames = await Promise.all(
            evaluations.map(async (e) => {
                const user = await User.findOne({ idmembre: e.id_eleve });
                return {
                    ...e.toObject(),
                    nom_eleve: user ? `${user.firstname} ${user.familyname}` : `Élève ${e.id_eleve}`,
                };
            })
        );

        const distribution = {1:0, 2:0, 3:0, 4:0, 5:0};
        evaluations.forEach(e => {
            const note = Math.round(e.note);
            if(distribution[note] !== undefined) distribution[note]++;
        });

        res.status(200).json({
            success: true,
            stats: { averageRating: teacher.rating, totalEvaluations: teacher.reviewsCount },
            reviews: reviewsWithNames,
            distribution
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Erreur : " + error.message });
    }
};