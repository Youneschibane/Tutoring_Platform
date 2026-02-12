const express = require('express');
const mongoose = require('mongoose');
const {signUp}=require('./connection/connection.js')


const mongoURI = 'mongodb+srv://oychibane_db_user:Ax3g1SLETz5L2Yfy@mongotutorial.e5dyfko.mongodb.net/?appName=MongoTutorial';


mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('MongoDB connected')) 
.catch(err => console.log(err));

const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.Post('/connect',connect());











app.listen(5000, () => {

  console.log('Server is running on port 3000');
});