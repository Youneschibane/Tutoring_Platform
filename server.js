const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

const adminRoutes =require('./src/routes/admin.routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/admin', adminRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connecte'))
  .catch(err => console.error('Erreur MongoDB :', err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Serveur admin demarre sur le port ' + PORT));
