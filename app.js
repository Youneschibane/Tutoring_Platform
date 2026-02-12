
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const SignUp = require('./Sign_In_Up/Sign_up.js')
const signIn = require('./Sign_In_Up/Sign_in.js')


const mongoURI = process.env.MONGO_URI;

console.log('Connecting to MongoDB...');
mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error: ' + err));

const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//sign up
app.post('/SignUp', SignUp);

//sign in
app.post('/SignIn', signIn);









const PORT = process.env.PORT || 5000;

console.log('Attempting to listen on port ' + PORT);
app.listen(PORT, () => {

  console.log('Server is running on port ' + PORT);
});