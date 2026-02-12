const mongoose = require('mongoose');



let enseignant=new mongoose.Schema({


  id_enseignant:{
    type:Number,
    required:true
  },




  nature:{type:String
    ,required:true
    //enum in english
    ,enum:["Independant","Etablissement","Center"]
  },




  latitude:{type:Number,
    required:true
  },



  longitude:{type:Number
    ,required:true
  },



  deplacment:{
    type:Boolean,
    required:true
  },




  rayon_deplacement:{
    type:Number,
    required:true
  },



  desciption_pedagogique:{
    type:String,
    required:true
  },



  parcours_academique:{
    type:String
    ,required:true
  },




  experience_professionnelle:{
    type:String,
    required:true
  
  },




  certifications:{
    type:String
    ,required:true
  },



  actif:{
    type:Boolean,
    required:true
  },


})


const Teacher=mongoose.model("Teacher",enseignant);
module.exports=Teacher;