const mongoose = require('mongoose');


let seance=new mongoose.Schema({


  id_seance:{type:Number,required:true},



  id_service:{type:Number,required:true},


  id_enseignant:{type:Number,required:true},


  date_seance:{type:Date,required:true},


  heure_debut:{type:Date,required:true},



  heure_fin:{type:Date,required:true},



  nombre_participants:{type:Number,required:true},



  modalite:{type:String,required:true,enum:["Planifiee","Annulee","Terminee"]},



  lieu:{type:String,required:true},



  lien_visio:{type:String,required:true},



  statut:{type:String,required:true,enum:["Annulee","Confirmee","Reportee"]},




  notes_enseignant:{type:String,required:true},

  
  date_creation:{type:Date,default:Date.now}
})
