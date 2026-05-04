require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initializeCronJobs, stopCronJobs } = require('./utils/cronService');

// ── If you have a cron file, import it here ──
 //const { initializeCronJobs, stopCronJobs } = require('./utils/cronJobs');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.setupRoutes(io);  
app.set('io', io);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room`);
  });

  socket.on('sendMessage', (data) => {
    io.to(`user_${data.to}`).emit('newMessage', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const mongoURI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log('Connecting to MongoDB...');
    mongoose.connect(mongoURI)
        .then(() => {
            console.log('✓ MongoDB connected');
            // initializeCronJobs();
            //console.log('✓ Background jobs initialized');
        })
        .catch(err => {
            console.error('❌ MongoDB connection error:', err);
        });
});

const handleShutdown = async (signal) => {
    console.log(`\n📍 ${signal} received, shutting down gracefully...`);
    stopCronJobs();
    server.close(async () => {
        console.log('✓ Server closed');
        await mongoose.connection.close();
        console.log('✓ MongoDB connection closed');
        process.exit(0);
    });
};
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT',  () => handleShutdown('SIGINT'));