const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Admin = require('../models/adminModel');
const Device = require('../models/deviceModel');
const getNextId = require('../generateID/nextID');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

exports.completeProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { signupToken, password, role, firstname, familyname, postaladr, ...profileData } = req.body;

    if (!signupToken) throw new Error("Missing signup token. Please verify your email or phone first.");
    if (!firstname || !familyname || !postaladr || !password || !role) {
      throw new Error("Missing required profile fields: firstname, familyname, postaladr, password, or role.");
    }

    // Decode the signup token to get verified contact info
    let decoded;
    try {
      decoded = jwt.verify(signupToken, process.env.JWT_SECRET);
    } catch (err) {
      throw new Error("Session expired or invalid token. Please verify email/phone again.");
    }

    // Determine contact field (email or numberphone)
    const contact = { [decoded.field]: decoded.value }; 

    // Check if user already exists
    const existingUser = await User.findOne(contact).session(session);
    if (existingUser) throw new Error("User already exists.");

    // Generate unique ID
    const idmembre = await getNextId('user');

    // Create main User
    const newUser = new User({
      firstname,
      familyname,
      postaladr,
      password,   // hashed automatically by schema pre-save
      role,
      idmembre,
      isVerified: true,
      ...contact, // email or numberphone
      ...profileData // optional extra fields
    });

    await newUser.save({ session });

    // Create role-specific profile
    let specificData = null;
    const specificProfileData = { firstname, familyname, postaladr, ...contact, ...profileData };

    switch (role) {
      case 'teacher':
        const teacher = new Teacher({ ...specificProfileData, id_enseignant: idmembre });
        await teacher.save({ session });
        specificData = teacher;
        break;
      case 'student':
      case 'parent':
        const student = new Student({ ...specificProfileData, id_eleve: idmembre });
        await student.save({ session });
        specificData = student;
        break;
      case 'admin':
        const admin = new Admin({ ...specificProfileData, id_admin: idmembre });
        await admin.save({ session });
        specificData = admin;
        break;
      default:
        throw new Error("Invalid role specified.");
    }

    await session.commitTransaction();
    session.endSession();

    // Register first device
    const currentIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
    const currentUserAgent = req.get('User-Agent') || '';

    // Parse user-agent for device name
    const parser = new UAParser(currentUserAgent);
    const browser = parser.getBrowser().name || 'Unknown Browser';
    const os = parser.getOS().name || 'Unknown OS';
    const deviceName = `${browser} on ${os}`;

    // Geo lookup from IP
    const geo = geoip.lookup(currentIP);
    const location = geo?.country || 'Unknown location';

    const deviceToken = uuidv4();

    const newDevice = new Device({
      userId: newUser._id,
      deviceToken,
      userAgent: currentUserAgent,
      ipAddress: currentIP,
      deviceName,
      location,
      lastUsed: new Date()
    });

    await newDevice.save();

    // Generate login JWT
    const loginToken = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Send response
    res.status(201).json({
      status: 'success',
      message: "Account created successfully!",
      token: loginToken,
      data: {
        user: newUser,
        details: specificData,
        device: {
          deviceToken,
          isNewDevice: true,
          lastUsed: newDevice.lastUsed,
          userAgent: newDevice.userAgent,
          deviceName: newDevice.deviceName,
          location: newDevice.location
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Signup Error:", error);
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};