const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Admin = require('../models/adminModel');
const Device = require('../models/deviceModel');
const getNextId = require('../generateID/nextID');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/sendEmail');
const { v4: uuidv4 } = require('uuid');



exports.completeProfile = async (req, res) => {
  // 1. Start a Session (Transaction)
  // We use this to ensure that if saving the Student profile fails, 
  // the User account is NOT created either. It's all or nothing.
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 2. Get Data from Frontend
    // We expect the signupToken (from Step 1) and the form details (Step 2)
    const { signupToken, password, role, ...profileData } = req.body;

    // 3. Verify the Signup Token
    if (!signupToken) {
      throw new Error("Missing signup token. Please verify your email first.");
    }

    let decoded;
    try {
      // This checks if the token is valid and not expired (20 mins)
      decoded = jwt.verify(signupToken, process.env.JWT_SECRET);
    } catch (err) {
      throw new Error("Session expired or invalid token. Please verify email again.");
    }

    // Extract the secure email from the token
    const email = decoded.email;

    // 4. Double check: Does this user exist already?
    // (In case they clicked the button twice rapidly)
    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
        throw new Error("User already exists.");
    }

    // 5. Generate the Custom ID (e.g., "U-1001")
    const idmembre = await getNextId('user');

    // 6. Create the Main USER (Authentication Data)
    const newUser = new User({
      email: email,       // From Token
      password: password, // Logic in model will hash this
      role: role,
      idmembre: idmembre,
      isVerified: true,   // Validated because they passed the OTP check!
      ...profileData      // Stores common data like name/phone if in User Schema
    });

    await newUser.save({ session });

    // 7. Create the Specific Profile (Role Data)
    let specificData = null;

    // We prepare the data object for the specific role
    const specificProfileData = {
        ...profileData,
        email: email,
        // We link them using the same ID
    };

    switch (role) {
      case 'teacher':
        const teacher = new Teacher({
            ...specificProfileData,
            id_enseignant: idmembre 
        });
        await teacher.save({ session });
        specificData = teacher;
        break;

      case 'student':
      case 'parent': // Treating parent as student structure or similar
        const student = new Student({
            ...specificProfileData,
            id_eleve: idmembre
        });
        await student.save({ session });
        specificData = student;
        break;

      case 'admin':
        const admin = new Admin({
            ...specificProfileData,
            id_admin: idmembre
        });
        await admin.save({ session });
        specificData = admin;
        break;

      default:
        throw new Error("Invalid Role specified.");
    }

    // 8. Commit the Transaction (Save everything permanently)
    await session.commitTransaction();
    session.endSession();

    // 9. Générer le deviceToken pour le premier appareil
    const currentIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const currentUserAgent = req.get('User-Agent') || '';
    const deviceToken = uuidv4();
    
    const newDevice = new Device({
      userId: newUser._id,
      deviceToken: deviceToken,
      userAgent: currentUserAgent,
      ipAddress: currentIP,
      lastUsed: new Date(),
    });
    
    await newDevice.save();

    // 10. Auto-Login (Optional but recommended)
    // Create a Login Token immediately so they don't have to sign in again
    const loginToken = jwt.sign(
        { id: newUser._id, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
    );

    // 11. Send Success Response
    res.status(201).json({
      status: 'success',
      message: "Account created successfully!",
      token: loginToken, // Send this so frontend can log them in
      data: {
        user: newUser,
        details: specificData,
        device: {
          deviceToken: deviceToken,
          isNewDevice: true,
          lastUsed: newDevice.lastUsed,
          userAgent: newDevice.userAgent
        }
      }
    });

  } catch (error) {
    // If ANY error happens, undo everything
    await session.abortTransaction();
    session.endSession();
    
    console.error("Signup Error:", error);
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

