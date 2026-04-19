const mongoose = require('mongoose');


let eleve=new mongoose.Schema({

  id_eleve:{
    type:Number,
    required:true
  
  },

yearOfStudy:{
    type:Number,
    required:false
},


  niveau_scolaire:{
    type:String,
    required:false,
    enum:["Primary","Secondary","High School","University"]
  },



  objectifs_pedagogiques:{
    type:String,
    required:false
},



  id_parent:{
    type:Number,
   
  },




})


const Eleve=mongoose.model('Eleve',eleve);
module.exports=Eleve;
