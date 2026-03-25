const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');

// 1. DÉMARRER UN CHAT
router.post('/', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    const newConversation = new Conversation({
      participants: [senderId, receiverId],
    });
    const savedConversation = await newConversation.save();
    res.status(200).json(savedConversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// 2. BOITE DE RÉCEPTION (Populate ajouté)
router.get('/:userId', async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.params.userId] },
    })
    .populate('participants', 'username profilePic') // Pour voir les infos des autres
    .sort({ updatedAt: -1 }); // Les conversations les plus récentes en haut
    
    res.status(200).json(conversations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

module.exports = router;