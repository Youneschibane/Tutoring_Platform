import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

// Connexion au serveur Node.js (ton backend)
const socket = io.connect("http://localhost:5000");

function App() {
  const [userId, setUserId] = useState(""); 
  const [convId, setConvId] = useState(""); 
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (convId) {
      socket.emit("join_conversation", convId);
      // Récupérer l'historique
      axios.get(`http://localhost:5000/api/messages/${convId}`)
           .then(res => setChat(res.data));
    }

    // Écouter les nouveaux messages (texte ET fichiers)
    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, data]);
    });

    return () => socket.off("receive_message");
  }, [convId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message && !file) return; 

    const formData = new FormData();
    formData.append("conversationId", convId);
    formData.append("sender", userId);
    formData.append("text", message);
    if (file) formData.append("file", file);

    try {
      await axios.post("http://localhost:5000/api/messages", formData);
      setMessage("");
      setFile(null);
      // Le message s'affichera via le socket.on("receive_message")
    } catch (err) {
      console.error("Erreur d'envoi:", err);
    }
  };

  // Fonction utilitaire pour construire l'URL correcte du fichier
  const getFileUrl = (url) => {
    if (!url) return "";
    if (url.startsWith('http')) return url; // Déjà une URL complète
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', color: 'white', minHeight: '100vh' }}>
      <h1>Chat App 💬</h1>
      
      <div style={{ marginBottom: '10px' }}>
        <input placeholder="Ton ID User" onChange={e => setUserId(e.target.value)} style={{ marginRight: '10px', padding: '5px' }} />
        <input placeholder="ID Conversation" onChange={e => setConvId(e.target.value)} style={{ padding: '5px' }} />
      </div>
      
      {/* Fenêtre de Chat */}
      <div style={{ 
        border: '1px solid #444', 
        height: '400px', 
        margin: '20px 0', 
        overflowY: 'scroll', 
        padding: '15px',
        backgroundColor: '#242424',
        borderRadius: '8px'
      }}>
        {chat.map((m, i) => (
          <div key={i} style={{ 
            marginBottom: '15px', 
            textAlign: m.sender === userId ? 'right' : 'left' 
          }}>
            <div style={{ 
              display: 'inline-block', 
              padding: '10px', 
              borderRadius: '10px', 
              backgroundColor: m.sender === userId ? '#005c4b' : '#333',
              maxWidth: '70%',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '0.7em', opacity: 0.6, marginBottom: '5px' }}>
                {m.sender === userId ? "Moi" : `Utilisateur: ${m.sender.substring(0,5)}...`}
              </div>

              {/* Texte du message */}
              {m.text && <div style={{ wordBreak: 'break-word' }}>{m.text}</div>}

              {/* Affichage des fichiers/images */}
              {m.fileUrl && (
                <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                  {m.messageType === 'image' ? (
                    <img 
                      src={getFileUrl(m.fileUrl)} 
                      alt="upload" 
                      style={{ maxWidth: '100%', borderRadius: '5px', display: 'block' }} 
                    />
                  ) : (
                    <button 
                      type="button"
                      onClick={() => window.open(getFileUrl(m.fileUrl), '_blank')}
                      style={{ 
                        color: '#3498db', 
                        background: 'none', 
                        border: '1px solid #3498db', 
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8em'
                      }}
                    >
                      📄 Télécharger le document
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Formulaire d'envoi */}
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input 
          value={message} 
          onChange={e => setMessage(e.target.value)} 
          placeholder="Écrivez un message..."
          style={{ flex: 1, padding: '12px', borderRadius: '5px', border: 'none', outline: 'none' }}
        />
        <input 
          type="file" 
          onChange={e => setFile(e.target.files[0])} 
          style={{ width: '200px', fontSize: '0.8em' }}
        />
        <button type="submit" style={{ 
          padding: '10px 20px', 
          cursor: 'pointer', 
          backgroundColor: '#00a884', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          fontWeight: 'bold'
        }}>
          Envoyer
        </button>
      </form>
    </div>
  );
}

export default App;