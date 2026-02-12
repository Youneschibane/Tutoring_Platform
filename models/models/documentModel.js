const mongoose = require('mongoose');



let document_pedagogique=new mongoose.Schema({



  id_document:{type:Number,required:true},


  id_seance:{type:Number,required:true},



  
  type_document:{type:String,required:true,enum:["Support_cours","Exercice","Correction","Autre"]},



  nom_fichier:{type:String,required:true},



  chemin_fichier:{type:String,required:true},



  taille_fichier:{type:Number,required:true},



  description:{type:String,required:true},



  data_ajout:{type:Date,default:Date.now}



})



const Document=mongoose.model('Document',document_pedagogique);
module.exports=Document;