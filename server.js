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

// routes with socket
app.setupRoutes(io);

// ── Socket.io events ──
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

// port
const PORT = process.env.PORT || 3000;

// start server AFTER DB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✓ MongoDB connected');
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// graceful shutdown
const handleShutdown = async (signal) => {
  console.log(`\n📍 ${signal} received, shutting down gracefully...`);
  stopCronJobs();

  httpServer.close(async () => {
    console.log('✓ Server closed');
    await mongoose.connection.close();
    console.log('✓ MongoDB connection closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// ── 404 handler (AFTER all routes) ──
app.use((req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[404] ${req.method} ${req.url}`);
  }
  res.status(404).json({ status: 'fail', message: 'Route introuvable.' });
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('[ERREUR]', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production'
      ? 'Erreur serveur.'
      : err.message,
  });
});