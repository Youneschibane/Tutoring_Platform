
const User = require('../models/user');
const bcrypt = require('bcrypt');

const signIn = async function (req, res) {
  try {
    const { email, phone, password } = req.body;

    // Find user by email or phone
    const user = await User.findOne({ $or: [{ email }, { phone }] }).select('+password');

    if (!user) {
      //wait few time (same time when we found the user) then send a message to do not give any information about the user to the hacker

      //we can change the message to do not give any information about the user to the hacker

      const time = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, time));
      return res.status(404).json({ message: "User not found" });
    }

    // Compare password with hashed password in DB
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      //wait few time (as the time when we found the user) then send a message to do not give any information about the user to the hacker
      const time = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, time));
      return res.status(401).json({ message: "  Incorrect password" });
    }


    // Remove password from response
    user.password = undefined;
    // Get full info according to the role of user
    switch (user.role) {
      case 'teacher':
        const teacher = await Teacher.findOne({ user: user._id });
        return res.status(200).json({ message: "Login successful", user, teacher });
      case 'student':
      case 'parent':
        const student = await Student.findOne({ user: user._id });
        return res.status(200).json({ message: "Login successful", user, student });
      case 'admin':
        const admin = await Admin.findOne({ user: user._id });
        return res.status(200).json({ message: "Login successful", user, admin });
      default:
        return res.status(200).json({ message: "Login successful", user });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = signIn;

