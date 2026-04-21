const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Dossier Uploads
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);

// CORS
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json());

//  FIX : les fichiers sur disque ont littéralement %20 dans leur nom
app.use('/uploads', (req, res) => {
     console.log('=== UPLOADS MIDDLEWARE TOUCHÉ ===');
    console.log('=== req.url:', req.url);
    console.log('=== req.path:', req.path);
    // Ne PAS décoder — le nom sur disque contient vraiment %20
    const fileName = req.path.replace(/^\//, '');
    const filePath = path.join(uploadsPath, fileName);
    
    console.log('=== fileName:', fileName);
    console.log('=== filePath:', filePath);
    console.log('=== existe?', fs.existsSync(filePath));
    
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Fichier introuvable:', filePath);
            res.status(404).json({ error: 'Fichier introuvable' });
        }
    });
});

// Socket.io
const io = new Server(server, { cors: { origin: "*" } });

// Routes
const mailRoute = require('./routes/mails')(io);
app.use('/api/mails', mailRoute);

// MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch((err) => console.error('MongoDB Error:', err));

io.on('connection', (socket) => {
    console.log('⚡ Nouvelle connexion Socket.id :', socket.id);

    socket.on('join_user_room', (userId) => {
        if (userId) {
            socket.join(userId);
            console.log(`L'utilisateur [${userId}] a rejoint sa Room.`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
});
