require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createUser } = require('./Sign_In_Up/up/Sign_up.js')
const { signIn } = require('./Sign_In_Up/up/Sign_in.js')


const mongoURI = process.env.MONGO_URI;


mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//sign up
app.post('/SignUp', SignUp);

//sign in
app.post('/SignIn', signIn);









const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log('Server is running on port ' + PORT);
});