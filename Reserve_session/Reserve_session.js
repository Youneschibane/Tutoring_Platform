const { Participation } = require('../models/participantModel');

const addParticipant = async (req, res) => {
  try {
    const { session_id, id_eleve, id_enseignant } = req.body;

    // Validation
    if (!session_id || !id_eleve) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Search for existing participation
    const session = await Participation.findOne({
      id_seance: session_id,
      id_eleve: id_eleve
    });

    if (session) {
      return res.status(400).json({
        message: 'Session already reserved'
      });
    }

    // Create participation
    const newParticipation = new Participation({
      id_eleve,
      id_seance: session_id,
      id_enseignant,
      date_participation: Date.now()
    });

    await newParticipation.save();

    res.status(201).json({
      message: 'Session request successful'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = addParticipant;
