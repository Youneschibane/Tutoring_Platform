const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Admin = require('../models/adminModel');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/sendEmail');
const bcrypt = require('bcrypt');
const handleDeviceDetection = require('../utils/deviceDetection');


// Il sert à faire "travailler" le processeur quand l'utilisateur n'est pas trouvé.
const DUMMY_HASH = '$2b$12$nY.9.Z.u.X.v.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S'; 

const signIn = async function (req, res) {
  try {

    const { email, phone, password, deviceToken } = req.body;

    // 1. Vérification basique des champs
    if ((!email && !phone) || !password) {
        return res.status(400).json({ 
            message: "Veuillez fournir un identifiant (email ou téléphone) et un mot de passe." 
        });
    }

    // 2. Construction de la requête (Email OU Téléphone)
    const query = {};
    if (email) query.email = email;
    if (phone) query.numberphone = phone; 

    // 3. Recherche de l'utilisateur (+password car il est caché par défaut)
    const user = await User.findOne(query).select('+password');

   
    
    // Si l'utilisateur existe, on prend son hash. Sinon, on prend le faux hash.
    const hashToCompare = user ? user.password : DUMMY_HASH;

    // On exécute la comparaison dans TOUS les cas.
    // Cela force le serveur à attendre ~300ms, que l'user existe ou pas.
    const isMatch = await bcrypt.compare(password, hashToCompare);

    // Si l'utilisateur n'existe pas OU si le mot de passe est faux
   
    if (!user || !isMatch) {
      return res.status(401).json({ message: "Email/Téléphone ou mot de passe incorrect" });
    }


        user.password = undefined;


    // Gestion du deviceToken
    const deviceResult = await handleDeviceDetection({ user, req, res });
    const device = deviceResult?.device;
    const isNewDevice = deviceResult?.isNewDevice;

      // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

  let roleData = null;
      switch (user.role) {
      case 'teacher':
        roleData = await Teacher.findOne({ id_enseignant: user.idmembre });
        break;
      case 'student':
        case 'parent':
        roleData = await Student.findOne({ id_eleve: user.idmembre });
        break;
      case 'admin':
        roleData = await Admin.findOne({ id_admin: user.idmembre });
        break;
      default:
        break;
    }

    
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
          userAgent: device?.userAgent
        }
      }
    });



  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Erreur serveur lors de la tentative de connexion." });
  }
};

module.exports = signIn;