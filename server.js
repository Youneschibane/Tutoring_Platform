require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { initializeCronJobs, stopCronJobs } = require('./utils/cronService');

const mongoURI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

console.log('Connecting to MongoDB...');

mongoose.connect(mongoURI)
  .then(() => {
    console.log('MongoDB connected');

    const server = app.listen(PORT,"0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
      
      // Initialize cron jobs after server starts
      console.log('\n🚀 Initializing background jobs...');
      try {
        initializeCronJobs();
        console.log('✓ Background jobs initialized successfully\n');
      } catch (error) {
        console.error('⚠️ Failed to initialize background jobs:', error.message);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n📍 SIGTERM received, shutting down gracefully...');
      stopCronJobs();
      server.close(() => {
        console.log('✓ Server closed');
        mongoose.connection.close(false, () => {
          console.log('✓ MongoDB connection closed');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('\n📍 SIGINT received, shutting down gracefully...');
      stopCronJobs();
      server.close(() => {
        console.log('✓ Server closed');
        mongoose.connection.close(false, () => {
          console.log('✓ MongoDB connection closed');
          process.exit(0);
        });
      });
    });

  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });