require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initializeCronJobs, stopCronJobs } = require('./utils/cronService');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*' }
});

// Enregistre les routes qui dépendent de io
app.setupRoutes(io);

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

const PORT = process.env.PORT || 3000;

// ✅ httpServer (avec Socket.IO) qui écoute, pas app
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✓ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err));
});

const handleShutdown = async (signal) => {
  console.log(`\n📍 ${signal} received, shutting down...`);
  stopCronJobs();
  httpServer.close(async () => {
    console.log('✓ Server closed');
    await mongoose.connection.close();
    console.log('✓ MongoDB connection closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT',  () => handleShutdown('SIGINT'));