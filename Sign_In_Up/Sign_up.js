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
  // Initialize session (endSession cleanup is done in finally block)
  let session;
  
  try {
    // Start a new Mongoose session for transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Extract and validate required fields
    const { signupToken, password, role, firstname, familyname, postaladr, ...profileData } = req.body;

    // Validate signup token exists
    if (!signupToken) {
      throw new Error("Missing signup token. Please verify your email or phone first.");
    }

    // Validate all required profile fields
    if (!firstname || !familyname || !postaladr || !password || !role) {
      throw new Error("Missing required profile fields: firstname, familyname, postaladr, password, or role.");
    }

    // Validate role is one of the allowed values
    const validRoles = ['parent', 'student', 'teacher', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role specified. Allowed roles: ${validRoles.join(', ')}`);
    }

    // Decode the signup token to get verified contact info
    let decoded;
    try {
      decoded = jwt.verify(signupToken, process.env.JWT_SECRET);
    } catch (err) {
      throw new Error("Session expired or invalid token. Please verify email/phone again.");
    }

    // Ensure decoded token has required fields
    if (!decoded.field || !decoded.value) {
      throw new Error("Invalid token structure. Missing field or value.");
    }

    // Determine contact field (email or numberphone)
    const contact = { [decoded.field]: decoded.value };

    // Check if user already exists with this contact info
    const existingUser = await User.findOne(contact).session(session);
    if (existingUser) {
      throw new Error("User already exists with this email or phone number.");
    }

    // Generate unique ID for the user
    const idmembre = await getNextId('user');

    // Create main User document
    const newUser = new User({
      firstname,
      familyname,
      postaladr,
      password,   // Will be hashed automatically by pre-save hook
      role,
      idmembre,
      isVerified: true,
      ...contact,        // email or numberphone
      ...profileData      // optional extra fields
    });

    // Save user and run pre-save hooks (password hashing, validation, etc.)
    // The session ensures this is part of the transaction
    await newUser.save({ session });

    // Create role-specific profile based on the user's role
    let specificData = null;
    const specificProfileData = { 
      firstname, 
      familyname, 
      postaladr, 
      ...contact, 
      ...profileData 
    };

    // Handle role-specific profile creation
    switch (role) {
      case 'teacher':
        {
          const teacher = new Teacher({ 
            ...specificProfileData, 
            id_enseignant: idmembre 
          });
          await teacher.save({ session });
          specificData = teacher;
          break;
        }
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
        // This should never happen due to validation above, but kept for safety
        throw new Error("Invalid role specified.");
    }

    // All saves successful, commit the transaction
    await session.commitTransaction();

    // ===== Device Registration (outside transaction) =====
    // Now that the user is created, register their first device
    try {
      // Extract IP address (works with proxies and direct connections)
      const currentIP = req.ip || 
                       req.connection?.remoteAddress || 
                       req.socket?.remoteAddress || 
                       '';
      
      // Get user agent string
      const currentUserAgent = req.get('User-Agent') || '';

      // Parse user-agent to extract browser and OS information
      const parser = new UAParser(currentUserAgent);
      const browser = parser.getBrowser().name || 'Unknown Browser';
      const os = parser.getOS().name || 'Unknown OS';
      const deviceName = `${browser} on ${os}`;

      // Geo lookup from IP address
      const geo = geoip.lookup(currentIP);
      const location = geo?.country || 'Unknown location';

      // Generate unique device token
      const deviceToken = uuidv4();

      // Create device record
      const newDevice = new Device({
        userId: newUser._id,
        deviceToken,
        userAgent: currentUserAgent,
        ipAddress: currentIP,
        deviceName,
        location,
        lastUsed: new Date()
      });

      // Save device data (non-critical, so outside transaction)
      await newDevice.save();

      // Generate login JWT token (90-day expiry)
      const loginToken = jwt.sign(
        { id: newUser._id, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
      );

      // Send success response
      return res.status(201).json({
        status: 'success',
        message: "Account created successfully!",
        token: loginToken,
        data: {
          user: {
            id: newUser._id,
            idmembre: newUser.idmembre,
            firstname: newUser.firstname,
            familyname: newUser.familyname,
            role: newUser.role,
            isVerified: newUser.isVerified
          },
          details: specificData,
          device: {
            deviceToken,
            isNewDevice: true,
            lastUsed: newDevice.lastUsed,
            deviceName: newDevice.deviceName,
            location: newDevice.location
          }
        }
      });

    } catch (deviceError) {
      // Device registration failed, but user already created
      console.error("Device registration error:", deviceError.message);
      
      // Generate login JWT anyway
      const loginToken = jwt.sign(
        { id: newUser._id, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
      );

      // Send response indicating partial success
      return res.status(201).json({
        status: 'success-partial',
        message: "Account created but device registration failed. Please log in.",
        token: loginToken,
        data: {
          user: {
            id: newUser._id,
            idmembre: newUser.idmembre,
            firstname: newUser.firstname,
            familyname: newUser.familyname,
            role: newUser.role,
            isVerified: newUser.isVerified
          },
          details: specificData
        }
      });
    }

  } catch (error) {
    // Transaction error - abort the transaction
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    
    console.error("Profile completion error:", error.message);
    
    // Determine appropriate HTTP status code
    let statusCode = 400;
    let message = error.message || 'Failed to complete profile';

    // Handle specific error types
    if (error.message.includes('duplicate key')) {
      statusCode = 409;
      message = 'Email or phone number already registered';
    } else if (error.message.includes('validation')) {
      statusCode = 422;
    }

    return res.status(statusCode).json({
      status: 'fail',
      message: message
    });

  } finally {
    // Ensure session is always ended, regardless of success or error
    if (session) {
      session.endSession();
    }
  }
};


/* IN CASE WE NEED TO GET COORDONATES 
// ... à l'intérieur de completeProfile, après avoir validé le signupToken
const { commune, wilaya, ...profileData } = req.body;

let coordinates ;
try {
    coords = await getCoordinatesFromCity(`${commune}, ${wilaya}, Algeria`);
} catch (error) {
    console.error("Géocodage échoué, utilisation de coordonnées par défaut");
}

// Remplissage du modèle User
const newUser = new User({
    firstname,
    familyname,
    password,
    role,
    idmembre,
    location: {
        type: "Point",
        coordinates: coords // Ici [lng, lat]
    },
    ...contact,
    ...profileData
});

// Le Teacher héritera de cette structure lors de sa création plus bas dans ton switch(role)
*/