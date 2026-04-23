const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({


  _id: {    // id specify the type for ex : users ( professor or student ), sessions , service .. 
    type: String,
    required: true,
    
  },


  seq: {// seq specify the last id in the seuence of  users or sessions services id.
    type: Number,
     default: 0,


  }
});

const Counter = mongoose.model('Counter', counterSchema);
module.exports = Counter;
