const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({

 

   id_parent:{
    type:Number,
    required:true
  
  },

  enfants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student"
  }]

}, { timestamps: true });

module.exports = mongoose.model("Parent", parentSchema);








 


