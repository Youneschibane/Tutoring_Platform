const admin = require('firebase-admin');
const AdminNotification = require('../models/AdminNotification');
const Admin = require('../models/Admin');

exports.notifyAdmin = async (title, message, type, teacherId = null) => {
    try {
       
        await AdminNotification.create({ 
            title, 
            message, 
            type, 
            teacherId: teacherId ? teacherId : null 
        });

        
        const admins = await Admin.find({ fcmToken: { $ne: null } });
        
        if (admins.length > 0) {
           
            const tokens = [...new Set(admins.map(a => a.fcmToken).filter(token => token))];

            if (tokens.length === 0) return;

            const messagePayload = {
                notification: {
                    title: title,
                    body: message,
                },
               
                data: {
                    type: String(type),
                    teacherId: teacherId ? String(teacherId) : ""
                }
            };

          
            const response = await admin.messaging().sendToDevice(tokens, messagePayload);
            
           
            console.log(`Succès: ${response.successCount} | Échecs: ${response.failureCount}`);
        }
    } catch (error) {
      
        console.error("Erreur critique Notification Admin:", error);
    }
};
