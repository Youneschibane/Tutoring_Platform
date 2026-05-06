const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const { protect } = require('../middleware/authMiddleware'); 

// 1. START A CHAT 
router.post('/', protect, async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user.id; // Identification via Token

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'You cannot start a chat with yourself' });
    }

    
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
      });
      await conversation.save();
    }
    
    res.status(200).json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// 2. FETCH MY INBOX 
router.get('/my-inbox', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user.id] }, 
    })
    .populate('participants', 'username profilePic email') 
    .sort({ updatedAt: -1 });
    
    res.status(200).json(conversations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

module.exports = router;





