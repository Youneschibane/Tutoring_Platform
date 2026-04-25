const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({

 

   id_parent:{
    type:Number,
    required:true
  
  },

 enfants: [
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Eleve',
    },
    firstname: String,
    familyname: String
  }
],

}, { timestamps: true });

module.exports = mongoose.model("Parent", parentSchema);








 


