const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mailRoute = require('./routes/mails')(io); // On passe l'objet 'io'

const app = express();
const server = http.createServer(app);

// --- 1. CONFIGURATION DU DOSSIER UPLOADS ---
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath);
}

// --- 2. CONFIGURATION CORS ---
// On définit les options une seule fois pour Express et Socket.io
const corsOptions = {
    origin: "http://localhost:5173", // L'URL de ton frontend Vite
    methods: ["GET", "POST"],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// --- 3. ACCÈS AUX FICHIERS STATIQUES ---
// On ajoute des headers de sécurité pour autoriser le navigateur à lire les fichiers
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(uploadsPath));

// --- 4. CONFIGURATION SOCKET.IO ---
const io = new Server(server, {
    cors: corsOptions
});

// --- 5. ROUTES ---
const conversationRoute = require('./routes/conversations');
const messageRoute = require('./routes/messages')(io);

app.use('/api/conversations', conversationRoute);
app.use('/api/messages', messageRoute);
app.use('/api/mails', mailRoute); 

// --- 6. CONNEXION MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// --- 7. LOGIQUE SOCKET.IO ---
io.on('connection', (socket) => {
    console.log(`🔌 Nouveau client connecté : ${socket.id}`);

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`👤 User joined room: ${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
        socket.leave(conversationId);
        console.log(`👤 User left room: ${conversationId}`);
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected');
    });
});

// --- 8. LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Files available at http://localhost:${PORT}/uploads/`);
});