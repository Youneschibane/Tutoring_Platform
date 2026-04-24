const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent = require('../models/parentModel');
const Admin = require('../models/adminModel');
const Device = require('../models/deviceModel');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const handleDeviceDetection = require('../utils/deviceDetection');

// Dummy hash to prevent timing attacks
const DUMMY_HASH = '$2b$12$LF2pOHq3PBnONQBFJMVnC.BbSNDTMRipqBR8eFoynF/BQDHpZIaWi';

const signIn = async (req, res) => {
  try {
    //----------------------------------------
    // 1. Get request data
    //----------------------------------------
    const { email, phone, password } = req.body;

    console.log("Login request:", req.body);

    //----------------------------------------
    // 2. Validation
    //----------------------------------------
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email/phone and password required'
      });
    }

    //----------------------------------------
    // 3. Build query
    //----------------------------------------
    let query = {};

    if (email) {
      query.email = email.trim().toLowerCase();
    }

    if (phone) {
      query.numberphone = phone.trim();
    }

    console.log("Search query:", query);

    //----------------------------------------
    // 4. Find user
    //----------------------------------------
    const user = await User.findOne(query).select('+password');

    if (!user) {
      console.log("USER NOT FOUND");
    } else {
      console.log("User found:", user.email);
      // Pour des raisons de sécurité en production, évite de logger le hash du mot de passe
      console.log("Stored hash:", user.password); 
    }

    //----------------------------------------
    // 5. Safe password comparison
    //----------------------------------------
    const hashToCompare = user ? user.password : DUMMY_HASH;

    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    console.log("Password match:", passwordMatch);

    if (!user || !passwordMatch) {
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect email/phone or password'
      });
    }

  
    //----------------------------------------
    // 7. Create JWT
    //----------------------------------------
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '90d'
      }
    );

    //----------------------------------------
    // 8. Device detection & Save Token (CORRIGÉ)
    //----------------------------------------
    let device = null;
    let isNewDevice = false;

    // Tentative de détection de l'appareil
    try {
      const deviceResult = await handleDeviceDetection({ user, req });
      device = deviceResult?.device;
      isNewDevice = deviceResult?.isNewDevice;
    } catch (deviceError) {
      console.error("Device detection error:", deviceError.message);
    }

    // Création d'un identifiant par défaut si la détection échoue (par ex. via Swagger)
    const currentDeviceToken = device?.deviceToken || `fallback-device-${Date.now()}`;

    // Sauvegarde garantie du token dans la collection Device
    try {
      await Device.findOneAndUpdate(
        {
          userId: user._id,
          deviceToken: currentDeviceToken
        },
        {
          jwtToken: token,
          lastUsed: new Date(),
          isActive: true,
          deviceName: device?.deviceName || 'Appareil inconnu',
          location: device?.location || 'Position inconnue'
        },
        {
          new: true,
          upsert: true // <-- Permet de créer le document s'il n'existe pas encore
        }
      );
    } catch (saveError) {
      console.error("Erreur lors de la sauvegarde du token dans Device :", saveError);
    }

    //----------------------------------------
    // 9. Get role-specific data
    //----------------------------------------
    let roleData = null;

    switch (user.role) {
      case 'teacher':
        roleData = await Teacher.findOne({ id_enseignant: user.idmembre });
        break;

      case 'student':
        roleData = await Student.findOne({ id_eleve: user.idmembre });
        break;

      case 'parent':
        const parent = await Parent.findOne({ id_parent: user.idmembre }).populate('enfants');
        const child = await Student.findOne({ id_parent: user.idmembre });
        roleData = { parent, child };
        break;

      case 'admin':
        roleData = await Admin.findOne({ id_admin: user.idmembre });
        break;
    }

    //----------------------------------------
    // 10. Remove password before sending
    //----------------------------------------
    user.password = undefined;

    //----------------------------------------
    // 11. Success response
    //----------------------------------------
    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token,
      data: {
        user,
        details: roleData,
        device: {
          deviceToken: currentDeviceToken,
          isNewDevice,
          lastUsed: device?.lastUsed || new Date(),
          deviceName: device?.deviceName || 'Appareil inconnu',
          location: device?.location || 'Position inconnue'
        }
      }
    });

  } catch (error) {
    console.error("SIGN IN ERROR:", error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during login'
    });
  }
};

module.exports = signIn;