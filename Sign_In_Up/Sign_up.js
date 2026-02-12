const User = require('../models/user');
const Teacher = require('../models/teacher');
const Student = require('../models/student');
const Admin = require('../models/admin');
const getNextId = require('../generateID/nextID');


const SignUp = async function (req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const data = req.body;

    const idmembre = await getNextId('user');

    // Save user
    const user = new User({ data, idmembre });
    await user.save({ session });

    // Save role-specific document
    switch (user.role) {
      case 'teacher':
        const teacher = new Teacher({ data, idmembre });
        await teacher.save({ session });
        break;

      case 'student':
      case 'parent':
        const student = new Student({ data, idmembre });
        await student.save({ session });
        break;

      case 'admin':
        const admin = new Admin({ data, idmembre });
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
