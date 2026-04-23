import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAYOg4prDp2kbrClZgxwehHIIz6VYjiN-c",
  authDomain: "tutorat-8e703.firebaseapp.com",
  projectId: "tutorat-8e703",
  storageBucket: "tutorat-8e703.firebasestorage.app",
  messagingSenderId: "742854739897",
  appId: "1:742854739897:web:6249f06aeddcc751eb1868",
  measurementId: "G-6BPYYZR1BY"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Initialisation de Messaging
export const messaging = getMessaging(app);

// Fonction pour demander la permission et récupérer le Token
export const requestForToken = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getToken(messaging, { 
        vapidKey: "BNsVBfK2c6mVGGoSSjGfP0Lhpz5pX4SDuLdgkSFXSYT0gCsQ6fd4yCqkWzTD46ZL1fr4oAuIni92j99d6JXiXdc" 
      });
      if (token) {
        console.log("Token FCM généré :", token);
        return token;
      }
    } else {
      console.log("Permission refusée");
    }
  } catch (error) {
    console.error("Erreur lors de la récupération du token", error);
  }
};