const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({

  id_admin: {
    type: Number,
    required: true,
    unique: true
  }, 

  fcmToken: {  // pour notifications 
    type: String,
    default: null,
},
  
  // Using strict: false to allow fields from req.body to be saved even if not explicitly defined here
  // since we don't know the full schema requirements yet.
}, { strict: false });

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
