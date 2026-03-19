require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const mongoURI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

console.log('Connecting to MongoDB...');

mongoose.connect(mongoURI)
  .then(() => {
    console.log('MongoDB connected');

    app.listen(PORT,"0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });

  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });