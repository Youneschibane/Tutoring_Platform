const mongoose = require('mongoose');

let enseignant=new mongoose.Schema({


  id_enseignant:{
    type:Number,
    required:true
  },

  nature:{type:String
    ,required:true
    ,enum:["Independant","Etablissement","Centre"]
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


  certifications:{
    type:String
    ,required:true
  },

  rayon_deplacement: {
    type: Number,
    required: true // meters
  },

  description_pedagogique: {
    type: String,
    required: true
  },

  certifications: {
    type: String,
    required: true
  },

  actif: {
    type: Boolean,
    required: true
  },

  
  rating: {
    type: Number,
    default: 0
  },

  reviewsCount: {
    type: Number,
    default: 0
  },

  online: {
    type: Boolean,
    default: false
  },

  subjects: [{
    type: String
  }]

});

 // GEO INDEX 
enseignant.index({ location: "2dsphere" });

enseignant.index({ rating: -1 });

const Teacher = mongoose.model("Teacher", enseignant);

module.exports = Teacher;