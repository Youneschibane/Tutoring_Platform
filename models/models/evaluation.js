const mongoose = require('mongoose');



let evaluation=new mongoose.Schema({



  id_evaluation:{type:Number,required:true},



  id_participation:{type:Number,required:true},




  note:{type:Number,required:true,min:0,max:5},



  qualite_enseignement:{type:Number,required:true,min:1,max:5},




  ponctualite:{type:Number,required:true,min:1,max:5},






  carte_explication:{type:Number,required:true,min:1,max:5},




  pedagogie:{type:Number,required:true,min:1,max:5},



  commentaire:{type:String,required:true},



  date_evaluation:{type:Date,default:Date.now},



  visible:{type:Boolean,required:true}


})



const Evaluation=mongoose.model('Evaluation',evaluation);
module.exports=Evaluation;