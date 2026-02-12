const express = require('express');
const mongoose = require('mongoose');
const { createUser } = require('./Sign_In_Up/up/Sign_up.js')
const { signIn } = require('./Sign_In_Up/up/Sign_in.js')


const mongoURI = 'mongodb+srv://oychibane_db_user:Ax3g1SLETz5L2Yfy@mongotutorial.e5dyfko.mongodb.net/?appName=MongoTutorial';


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











app.listen(5000, () => {

  console.log('Server is running on port 3000');
});