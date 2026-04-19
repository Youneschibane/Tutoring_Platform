const mongoose = require("mongoose");

const educationSchema = new mongoose.Schema({
  cycle: { type: String, required: true },   
  level: { type: Number , required: true },
  levelName: { type: String },    
  specialty: { type: String, default: "" },   
  subjects: [{ type: String }]                
});

module.exports = mongoose.model("Education", educationSchema);