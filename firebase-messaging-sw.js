importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAYOg4prDp2kbrClZgxwehHIIz6VYjiN-c",
  projectId: "tutorat-8e703",
  storageBucket: "tutorat-8e703.firebasestorage.app",
  messagingSenderId: "742854739897",
  appId: "1:742854739897:web:6249f06aeddcc751eb1868"
});

const messaging = firebase.messaging();