const mongoose = require('mongoose');

let devis_pedagogique=new mongoose.Schema({



  id_devis:{type:Number,required:true},



  id_eleve:{type:Number,required:true},



  id_enseignant:{type:Number,required:true},



  matiere:{type:String,required:true},



  niveau_scolaire:{type:String,required:true,enum:["Primaire","Moyen","Lycee","ESI"]},

  annee_scolaire:{type:String,required:true},


  objectif:{type:String,required:true},



  frequence_souhaite:{type:String,required:true},




  duree_estimee:{type:String,required:true},



  budget_estime:{type:Number,required:true},




  statut:{type:String,required:true,enum:["En_attente","Accepte","Refuse"]},


  repondue:{type : Boolean},

  reponse_enseignant:{type:String,required:true},




  date_demande:{type:Date,default:Date.now},



  date_reponse:{type:Date}



})


const Devis=mongoose.model('Devis',devis_pedagogique);

module.exports=Devis;