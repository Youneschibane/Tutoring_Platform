const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Admin = require('../models/adminModel');
const getNextId = require('../generateID/nextID');
const mongoose = require('mongoose');


const SignUp = async function (req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const data = req.body;

    const idmembre = await getNextId('user');
    const role = data.role;

    // Save user
    const user = new User({ ...data, idmembre });
    await user.save({ session });

    // Save role-specific document
    switch (role) {
      case 'teacher':
        const teacher = new Teacher({ ...data, id_enseignant: idmembre });
        await teacher.save({ session });
        break;

      case 'student':
      case 'parent':
        const student = new Student({ ...data, id_eleve: idmembre });
        await student.save({ session });
        break;

      case 'admin':
        const admin = new Admin({ ...data, id_admin: idmembre });
        await admin.save({ session });
        break;
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: "User saved", user, idmembre: idmembre });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};


module.exports = SignUp;
