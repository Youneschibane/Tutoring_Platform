require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initializeCronJobs, stopCronJobs } = require('./utils/cronService');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// ── Setup socket routes FIRST ──
app.setupRoutes(io);
app.set('io', io);

// ── 404 and error handler LAST (after all routes) ──
app.use((req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(\x1b[31m[404] ${req.method} ${req.url}\x1b[0m);
  }
  res.status(404).json({ status: 'fail', message: 'Route introuvable.' });
});

app.use((err, req, res, next) => {
  console.error(\x1b[31m[ERREUR]\x1b[0m, err);
  res.status(err.status  500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Erreur serveur.' : err.message,
  });
});

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

// ── Single server listen (httpServer, NOT app.listen) ──
const PORT = process.env.PORT  3000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✓ MongoDB connected');
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(🚀 Server running on port ${PORT});
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ── Graceful shutdown ──
const handleShutdown = async (signal) => {
  console.log(\n📍 ${signal} received, shutting down gracefully...);
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