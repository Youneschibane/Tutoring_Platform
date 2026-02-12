const mongoose = require('mongoose');



let service=new mongoose.Schema({

  id_service:{
    type:Number
    ,required:true
  },



  id_enseignant:{type:Number,required:true},



  nom_service:{type:String,required:true},


  type_service:{type:String,required:true,enum:["Individuel","Groupe","Preparation_examen"]},


  
  matiere:{type:String,required:true},

  
  niveau_concerne:{type:String,required:true,enum:["Primaire","Collège","Lycée","Université"]},



  nombre_max_participants:{type:Number,required:true},



  prix:{type:Number,required:true},


  duree_seance:{type:Number,required:true},




  description:{type:String,required:true},



  actif:{type:Boolean,required:true},



  date_creation:{type:Date,default:Date.now}
})


const Service=mongoose.model('Service',service);
module.exports=Service;