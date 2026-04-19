const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Admin = require('../models/adminModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const handleDeviceDetection = require('../utils/deviceDetection');
const { sendEmail } = require('../utils/sendEmail');

// Dummy hash to prevent timing attacks when user does not exist
const DUMMY_HASH = '$2b$12$nY.9.Z.u.X.v.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S';

const signIn = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    //  Basic validation
    if ((!email && !phone) || !password) {
      return res.status(400).json({ 
        message: "Veuillez fournir un identifiant (email ou téléphone) et un mot de passe." 
      });
    }

    //  Build query
    const query = {};
    if (email) query.email = email;
    if (phone) query.numberphone = phone; 

    //  Find user and include password
    const user = await User.findOne(query).select('+password');

    //  Compare password safely
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !isMatch) {
      return res.status(401).json({ message: "Email/Téléphone ou mot de passe incorrect" });
    }

    //  Mask password before returning
    user.password = undefined;

    //  Device detection (new or existing)
    const deviceResult = await handleDeviceDetection({ user, req });
    const device = deviceResult?.device;
    const isNewDevice = deviceResult?.isNewDevice;

    //  Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    //  Fetch role-specific data
    let roleData = null;
    switch (user.role) {
      case 'teacher':
        roleData = await Teacher.findOne({ id_enseignant: user.idmembre });
        break;
      case 'student':
        roleData = await Student.findOne({ id_eleve: user.idmembre });
        break;
      case 'parent':
        roleData = await Parent.findOne({ id_parent: user.idmembre });
        break;
      case 'admin':
        roleData = await Admin.findOne({ id_admin: user.idmembre });
        break;
      default:
        break;
    }

    //  Return response including full device info
    return res.status(200).json({
      status: 'success',
      message: "Connexion réussie",
      token,
      data: {
        user,
        details: roleData,
        device: {
          deviceToken: device?.deviceToken,
          isNewDevice,
          lastUsed: device?.lastUsed,
          userAgent: device?.userAgent,
          deviceName: device?.deviceName,
          location: device?.location
        }
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Erreur serveur lors de la tentative de connexion." });
  }
};

module.exports = signIn;