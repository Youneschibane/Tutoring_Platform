const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent  = require('../models/parentModel');
const Admin   = require('../models/adminModel');
const Device  = require('../models/deviceModel');

const cloudinary = require('../Config/Cloudinaryconfig · JS');
const getNextId  = require('../generateID/nextID');

const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UAParser = require('ua-parser-js');
const geoip    = require('geoip-lite');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const rollbackCloudinaryFiles = async (ids = []) => {
  await Promise.allSettled(
    ids.map(id => cloudinary.uploader.destroy(id))
  );
};

const parseChildren = (children) => {
  if (!children) return [];

  try {
    return typeof children === 'string'
      ? JSON.parse(children)
      : children;
  } catch {
    throw new Error("Invalid children format.");
  }
};

const createDevice = async (user, req) => {
  const ip = req.ip || '';
  const ua = req.get('User-Agent') || '';

  const parser = new UAParser(ua);
  const deviceName = `${parser.getBrowser().name || 'Unknown'} on ${parser.getOS().name || 'Unknown'}`;

  const geo = geoip.lookup(ip);

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '90d' }
  );

  const device = await Device.create({
    userId: user._id,
    deviceToken: uuidv4(),
    jwtToken: token,
    userAgent: ua,
    ipAddress: ip,
    deviceName,
    location: geo?.country || 'Unknown',
    isActive: true,
    lastUsed: new Date()
  });

  return { device, token };
};

// ─────────────────────────────────────────────
// MAIN CONTROLLER
// ─────────────────────────────────────────────
exports.completeProfile = async (req, res) => {
  let session;
  const uploaded = [];

  // ─────────────────────────────────────────────
  // SAFE JSON PARSER (IMPORTANT)
  // ─────────────────────────────────────────────
  const safeJSON = (value, errorMsg) => {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new Error(errorMsg);
      }
    }
    return value;
  };

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const {
      signupToken,
      password,
      role,
      firstname,
      familyname,
      postaladr,
      ...profileData
    } = req.body;

    // ─────────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────────
    if (!signupToken || !password || !role || !firstname || !familyname || !postaladr) {
      throw new Error("Missing required fields.");
    }

    const roles = ['parent', 'student', 'teacher', 'admin'];
    if (!roles.includes(role)) throw new Error("Invalid role.");

    // ─────────────────────────────────────────────
    // FIX: MULTIPART JSON FIELDS
    // ─────────────────────────────────────────────
    profileData.subjects = safeJSON(profileData.subjects, "Invalid subjects format");
    profileData.children = safeJSON(profileData.children, "Invalid children format");

    // ─────────────────────────────────────────────
    // VERIFY TOKEN
    // ─────────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(signupToken, process.env.JWT_SECRET);
    } catch {
      throw new Error("Invalid or expired token.");
    }

    const contactField = decoded.field === 'phone' ? 'numberphone' : decoded.field;
    const contact = { [contactField]: decoded.value };

    const exists = await User.findOne(contact).session(session);
    if (exists) throw new Error("User already exists.");

    // ─────────────────────────────────────────────
    // FILES HANDLING (CLOUDINARY)
    // ─────────────────────────────────────────────
const photoFile      = req.files?.photo_profil?.[0] || null;
const photoProfilUrl = photoFile?.path || null;
if (photoFile?.filename) uploaded.push(photoFile.filename);


const cvFile = req.files?.cv?.[0] || null;

const cv = cvFile ? {
  url: cvFile.path,
  publicId: cvFile.filename,
  uploadedAt: new Date()
} : null;
const diplomes = (req.files?.diplomes || []).map((f, i) => {
  uploaded.push(f.filename);

  return {
    url: f.path,
    publicId: f.filename,
    nom: profileData[`diplome_nom_${i}`] || null,
    uploadedAt: new Date()
  };
});

    // ──────

    // ─────────────────────────────────────────────
    // CREATE USER
    // ─────────────────────────────────────────────
    const idmembre = await getNextId('user');

    const newUser = await User.create([{
  firstname,
  familyname,
  postaladr,
  password,
  role,
  idmembre,
  isVerified:   true,
  isActive:     true,
  photo_profil: photoProfilUrl,  // ← ajouter cette ligne
  ...contact,
  ...profileData
}], { session });

    const user = newUser[0];

    const baseData = {
      firstname,
      familyname,
      postaladr,
      ...contact,
      ...profileData
    };

    let details;

    // ─────────────────────────────────────────────
    // ROLE: TEACHER
    // ─────────────────────────────────────────────
    if (role === 'teacher') {
  const teacher = await Teacher.create([{
    ...baseData,
    id_enseignant:    idmembre,
    accepted:         false,
    acceptanceStatus: 'pending',
    photo_profil:     photoProfilUrl,
    documents: {
      cv,
      diplomes   // 
    }
  }], { session });

  details = teacher[0];
}

    // ─────────────────────────────────────────────
    // ROLE: STUDENT
    // ─────────────────────────────────────────────
    else if (role === 'student') {
      const student = await Student.create([{
        ...baseData,
        id_eleve: idmembre,
        photo_profil: photoProfilUrl
      }], { session });

      details = student[0];
    }

    // ─────────────────────────────────────────────
    // ROLE: PARENT
    // ─────────────────────────────────────────────
    else if (role === 'parent') {
      const children = profileData.children || [];

      if (!Array.isArray(children) || children.length === 0) {
        throw new Error("At least one child required.");
      }

      const parent = new Parent({
        id_parent: idmembre,
        enfants: [],
        photo_profil: photoProfilUrl
      });

      for (const child of children) {
        if (!child.firstname || !child.familyname) {
          throw new Error("Each child must have firstname and familyname.");
        }

        const childId = await getNextId('student');

        const newChild = await Student.create([{
          id_eleve: childId,
          id_parent: idmembre,
          firstname: child.firstname,
          familyname: child.familyname
        }], { session });

        const student = newChild[0];

        parent.enfants.push({
          student: student._id,
          firstname: student.firstname,
          familyname: student.familyname
        });
      }

      await parent.save({ session });
      details = parent;
    }

    // ─────────────────────────────────────────────
    // ROLE: ADMIN
    // ─────────────────────────────────────────────
    else if (role === 'admin') {
      const admin = await Admin.create([{
        ...baseData,
        id_admin: idmembre,
        photo_profil: photoProfilUrl
      }], { session });

      details = admin[0];
    }

    // ─────────────────────────────────────────────
    // COMMIT TRANSACTION
    // ─────────────────────────────────────────────
    await session.commitTransaction();

    // ─────────────────────────────────────────────
    // DEVICE CREATION
    // ─────────────────────────────────────────────
    let deviceData;
    let token;

    try {
      ({ device: deviceData, token } = await createDevice(user, req));
    } catch (e) {
      token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
      );
    }

    return res.status(201).json({
      status: 'success',
      token,
      data: {
        user,
        details,
        device: deviceData || null
      }
    });

  } catch (err) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    await rollbackCloudinaryFiles(uploaded);

    console.log(err);

    return res.status(400).json({
      status: 'fail',
      message: err.message
    });

  } finally {
    if (session) session.endSession();
  }
};