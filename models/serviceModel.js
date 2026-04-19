const mongoose = require('mongoose');

let service=new mongoose.Schema({

  id_service:{
    type:Number
    ,required:true,
    unique:true
  },



  id_enseignant:{type:Number,required:true},



  nom_service:{type:String,required:true},


  type_service:{type:String,required:true,enum:["Individuel","Groupe"]},


  
  matiere:{type:String,required:true},

  
  niveau_concerne:{type:String,required:true,enum:["Primaire","Collège","Lycée","ESI"]},

  annee_concerne:{type:String , required:true},


  nombre_max_participants:{type:Number,required:true},


  prix:{type:Number,required:true},


  duree_seance:{type:Number,required:true},


  description:{type:String,required:true},


  actif:{type:Boolean,required:true},

  date_creation:{type:Date,default:Date.now},

  isDeleted:{
    type : Boolean,
    required: true
  }
})

service.index({ matiere: 1 });
service.index({ prix: 1 });
service.index({ niveau_concerne: 1 });

const Service=mongoose.model('Service',service);
module.exports=Service;