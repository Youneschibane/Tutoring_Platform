const mongoose = require('mongoose');


let eleve=new mongoose.Schema({

  id_eleve:{
    type:Number,
    required:true
  
  },




  niveau_scolaire:{
    type:String,
    required:true,
    enum:["Primary","Secondary","High School","University"]
  },



  objectifs_pedagogiques:{
    type:String,
    required:true
},



  id_parent:{
    type:Number,
    required:true
  },




})


const Eleve=mongoose.model('Eleve',eleve);
module.exports=Eleve;
