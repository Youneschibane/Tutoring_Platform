require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room`);
  });

  // Send message
  socket.on('sendMessage', (data) => {
    // data = { from, to, message, conversationId }
    io.to(`user_${data.to}`).emit('newMessage', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const mongoURI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

mongoose.connect(mongoURI)
  .then(() => {
    console.log('MongoDB connected');
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));