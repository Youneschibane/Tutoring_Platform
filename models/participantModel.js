const mongoose = require('mongoose');

let participation=new mongoose.Schema({


  id_eleve:{type:Number,required:true},


  id_seance:{type:Number,required:true},


  id_enseignant:{type:Number,required:true},


  data_participation:{type:Date,default:Date.now},


})



const Participation=mongoose.model('Participation',participation);
module.exports=Participation;