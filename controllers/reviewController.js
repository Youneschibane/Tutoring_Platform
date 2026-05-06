const Evaluation = require('../models/evaluation');
const Teacher = require('../models/teacherModel'); 
const User = require('../models/userModel'); // ← ajouter en haut du fichier

exports.createReview = async (req, res) => {
    try {
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

        await newEval.save();

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

        res.status(201).json({ 
            success: true, 
            message: "Évaluation enregistrée avec succès.", 
            data: newEval 
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Erreur lors de la création de l'évaluation : " + error.message });
    }
};

exports.getTeacherReviews = async (req, res) => {
  try {
    const profId = parseInt(req.params.id_enseignant);

    const allEvaluations = await Evaluation.find({ 
      id_enseignant: profId
    }).sort({ date_evaluation: -1 });
    
    const visibleEvaluations = allEvaluations.filter(e => e.visible === true);
    
    const reviewsWithNames = await Promise.all(
      visibleEvaluations.map(async (e) => {
        const user = await User.findOne({ idmembre: e.id_eleve });
        return {
          ...e.toObject(),
          nom_eleve: user ? `${user.firstname} ${user.familyname}` : `Élève ${e.id_eleve}`,
        };
      })
    );

    const distribution = {1:0, 2:0, 3:0, 4:0, 5:0};
    let sumNotes = 0;
    
    visibleEvaluations.forEach(e => {
      const note = Math.round(e.note);
      sumNotes += note;
      if(distribution[note] !== undefined) distribution[note]++;
    });
    
    const totalEvaluations = visibleEvaluations.length;
    const averageRating = totalEvaluations > 0 ? sumNotes / totalEvaluations : 0;

    res.status(200).json({
      success: true,
      stats: { 
        averageRating: parseFloat(averageRating.toFixed(2)), 
        totalEvaluations: totalEvaluations 
      },
      reviews: reviewsWithNames,
      distribution
    });

  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur : " + error.message });
  }
};

exports.getMyReviews = async (req, res) => {
  try {
    const profId = parseInt(req.params.id_enseignant);
 
    const allEvaluations = await Evaluation.find({ 
      id_enseignant: profId
    }).sort({ date_evaluation: -1 });
    
    const visibleEvaluations = allEvaluations.filter(e => e.visible === true);
    
    const reviewsWithNames = await Promise.all(
      visibleEvaluations.map(async (e) => {
        const user = await User.findOne({ idmembre: e.id_eleve });
        return {
          ...e.toObject(),
          nom_eleve: user ? `${user.firstname} ${user.familyname}` : `Élève ${e.id_eleve}`,
        };
      })
    );

    const distribution = {1:0, 2:0, 3:0, 4:0, 5:0};
    let sumNotes = 0;
    
    visibleEvaluations.forEach(e => {
      const note = Math.round(e.note);
      sumNotes += note;
      if(distribution[note] !== undefined) distribution[note]++;
    });
    
    const totalEvaluations = visibleEvaluations.length;
    const averageRating = totalEvaluations > 0 ? sumNotes / totalEvaluations : 0;

    res.status(200).json({
      success: true,
      stats: { 
        averageRating: parseFloat(averageRating.toFixed(2)), 
        totalEvaluations: totalEvaluations 
      },
      reviews: reviewsWithNames,
      distribution
    });
    
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};