require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('../models/serviceModel');

async function fix() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("🔧 Fixing services...");

    await Service.updateMany(
      { suspendu: { $exists: false } },
      { $set: { suspendu: false } }
    );

    await Service.updateMany(
      { isDeleted: { $exists: false } },
      { $set: { isDeleted: false } }
    );

    console.log("✅ Fix completed");

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix();