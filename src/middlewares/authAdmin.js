const User = require('../models/User');
const Admin = require('../models/Admin');

const authAdmin = async (req, res, next) => {
    try {
        // 1. On suppose que req.user a été rempli par ton middleware d'auth classique (JWT)
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ message: "Accès refusé : Grade Administrateur requis." });
        }

        // 2. Vérification dans ta table spécifique Admin
        // On lie l'id_admin du modèle Admin au idmembre du modèle User
       /* const adminEntry = await Admin.findOne({ id_admin: req.user.idmembre });
        
        if (!adminEntry) {
            return res.status(403).json({ message: "Action interdite : Profil admin non trouvé." });
        }*/

        next(); // Tout est bon, on continue vers le contrôleur
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la vérification admin." });
    }
};

module.exports = authAdmin;