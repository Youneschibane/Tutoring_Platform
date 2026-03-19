const Seance = require('../models/sessionModel'); 
const Eleve = require('../models/studentModel');   

const bookSession = async (req, res) => {
  try {
    const { session_id, id_eleve} = req.body;

    // Validation de base
    if (!session_id || !id_eleve_mongo) {
      return res.status(400).json({ message: 'Identifiants session et élève requis' });
    }

    // 2. Vérifier si l'élève existe dans la collection Eleve

    const student = await Eleve.findOne({id_eleve});
    if (!student) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
    const id_eleve_mongo = student._id;
    
    // 3. Mise à jour atomique de la séance
    const session = await Seance.findOneAndUpdate(
      {
        session_id: session_id,
        // Conditions pour accepter l'inscription :
        statut: { $in: ['en_attente', 'confirmee'] }, // Uniquement si pas annulée ou terminée
        $expr: { $lt: [{ $size: '$etudiants' }, '$nombre_max_participants'] }, // Reste de la place
        etudiants: { $ne: id_eleve_mongo } // L'élève n'est pas déjà dans le tableau
      },
      { 
        $push: { etudiants: id_eleve_mongo } 
      },
      { 
        new: true,
        runValidators: true 
      }
    ).populate('service enseignant', 'nom prenom titre'); // Optionnel: pour voir les détails

    // 4. Gestion de l'échec de mise à jour
    if (!session) {
      // On vérifie si la séance existe pour donner un message précis
      const checkSession = await Seance.findById(session_id);
      if (!checkSession) return res.status(404).json({ message: 'Séance introuvable' });
      
      return res.status(400).json({ 
        message: 'Réservation impossible : séance complète, déjà réservée ou statut invalide' 
      });
    }

    // 5. Succès
    //changer statut en-attente->completed
     if (session.statut === 'en_attente' ) {
      session.statut = 'confirmee';
      await session.save(); 
    }
    return res.status(201).json({
      message: 'Inscription réussie',
      session
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



const getPastSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body; // Ton identifiant numérique (ex: 101)

    // 1. Trouver l'élève pour obtenir son _id MongoDB
    const student = await Eleve.findOne({ id_eleve });
    if (!student) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    // 2. Chercher les séances terminées où l'élève était présent
    const sessions = await Seance.find({
      statut: 'terminee',
      etudiants: student._id // MongoDB cherche automatiquement si cet ID est dans le tableau
    })
    .populate('service enseignant', 'nom prenom titre')
    .sort({ date_seance: -1 }); // Trie par la plus récente en premier

    // 3. Renvoyer la réponse
    return res.status(200).json({
      count: sessions.length,
      sessions
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};



const getUpcomingSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;

    // 1. Trouver l'élève pour obtenir son _id technique
    const student = await Eleve.findOne({ id_eleve });
    if (!student) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }

    // 2. Chercher les séances futures (Confirmées ou Reportées)
    const sessions = await Seance.find({
      etudiants: student._id, // L'élève est dans la liste
      statut: { $in: ['confirmee', 'reportee'] } 
    })
    .populate('service enseignant', 'nom prenom titre')
    .sort({ date_seance: 1 }); // La plus proche en premier

    // 3. Réponse
    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};






module.exports = { 
  bookSession, 
  getPastSessions ,
  getUpcomingSessions
};
