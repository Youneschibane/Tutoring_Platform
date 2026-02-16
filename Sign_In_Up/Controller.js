
const Otp = require('../models/otpModel');
const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Admin = require('../models/adminModel');
const getNextId = require('../generateID/nextID');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Vérifier si l'utilisateur a déjà un COMPTE FINAL (Table User)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    // 2. Vérifier s'il y a déjà un CODE EN COURS (Table Otp)
    const existingOtp = await Otp.findOne({ email });

    if (existingOtp) {
        // --- ANTI-SPAM ---
        // On vérifie si le dernier code a été envoyé il y a moins de 1 minute
        const lastCreated = new Date(existingOtp.createdAt).getTime();
        const now = Date.now();
        
        if (now - lastCreated < 60 * 1000) { // 60000ms = 1 minute
            return res.status(429).json({ 
                message: "Veuillez attendre 1 minute avant de demander un nouveau code." 
            });
        }
    }

    // 3. Générer un NOUVEAU code
    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Sauvegarder ou Mettre à jour (Upsert)
    // Si le code existait (mais était vieux) ou n'existait pas (expiré), on le remplace.
    // IMPORTANT : On force la mise à jour de 'createdAt' pour relancer le timer de 10 min !
    await Otp.findOneAndUpdate(
      { email },
      { 
          email, 
          otp: newOtpCode,
          createdAt: new Date() // On remet le compteur à zéro !
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Envoyer l'email
    await sendEmail({
      email,
      subject: 'Votre code de vérification',
      message: `Votre code est : ${newOtpCode}. Valide pour 10 minutes.`
    });

    res.status(200).json({ 
        status: 'success', 
        message: 'Code envoyé (ou renvoyé) avec succès !' 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


