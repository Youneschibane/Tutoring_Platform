const mongoose = require('mongoose');
const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent = require('../models/parentModel');
const Admin = require('../models/adminModel');
const cloudinary = require('cloudinary').v2;

/* ---------------------------------------------------- */
/* HELPER: EXTRACT CLOUDINARY PUBLIC_ID FROM URL        */
/* ---------------------------------------------------- */
const getCloudinaryPublicId = (photoString) => {
    if (!photoString) return null;
    
    // Si ce n'est pas une URL, c'est probablement déjà un public_id
    if (!photoString.startsWith('http')) return photoString;

    try {
        // Exemple d'URL : https://res.cloudinary.com/demo/image/upload/v1234567890/folder/file.jpg
        // Séparer par '/upload/' pour isoler le chemin
        const afterUpload = photoString.split('/upload/')[1];
        if (!afterUpload) return photoString;

        // Supprimer la balise de version (ex: 'v1234567890/') si elle existe
        const pathWithoutVersion = afterUpload.replace(/^v\d+\//, '');

        // Supprimer l'extension de fichier (ex: '.jpg', '.png')
        const publicId = pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf('.'));
        
        return publicId || photoString;
    } catch (err) {
        return photoString; // Fallback sécurisé
    }
};

/* ---------------------------------------------------- */
/* GENERIC UPDATE CONTROLLER                            */
/* ---------------------------------------------------- */
const performUpdate = async (req, res, roleConfig) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    let oldPhotoToDelete = null; // Track old photo for safe deletion later

    try {
        const userId = req.user.id;
        const {
            firstname, familyname, postaladr, email, numberphone, ...extraFields
        } = req.body || {};

        // 1. Fetch user once
        const user = await User.findById(userId).session(session);
        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({ status: "fail", message: "Utilisateur introuvable" });
        }

        /* ---------- USER UPDATE ---------- */
        let userUpdates = {};

        if (firstname !== undefined && firstname !== '') userUpdates.firstname = firstname;
        if (familyname !== undefined && familyname !== '') userUpdates.familyname = familyname;
        if (postaladr !== undefined && postaladr !== '') userUpdates.postaladr = postaladr;
        if (email !== undefined && email !== '') userUpdates.email = email;
        if (numberphone !== undefined && numberphone !== '') userUpdates.numberphone = numberphone;

      // AJOUTE CE CONSOLE.LOG POUR DÉBUGGER
        console.log("Fichier intercepté par multer :", req.file);

        // 2. Handle Image Safely (Queue old image for deletion)
        if (req.file) {
            // On vérifie path, puis secure_url au cas où
            const photoUrl = req.file.path || req.file.secure_url; 
            
            if (photoUrl) {
                userUpdates.photo_profil = photoUrl; 
                
                // Si l'utilisateur avait une ancienne photo, on la marque pour suppression APRÈS le commit
                if (user.photo_profil) {
                    oldPhotoToDelete = user.photo_profil; 
                }
            } else {
                console.log("⚠️ Le fichier a été reçu mais aucune URL n'a été trouvée.");
            }
        }
        // 3. Update User
        let updatedUser = user;
        if (Object.keys(userUpdates).length > 0) {
            updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: userUpdates },
                { new: true, runValidators: true, session }
            ).select("-password");
        }

        /* ---------- ROLE UPDATE ---------- */
        const { model, idField, allowedFields, roleName } = roleConfig;
        const roleUpdates = {};

        allowedFields.forEach(field => {
            if (extraFields[field] !== undefined) {
                roleUpdates[field] = extraFields[field];
            }
        });

        let updatedSpecific = null;
        const memberId = updatedUser.idmembre || updatedUser._id;

        if (Object.keys(roleUpdates).length > 0) {
            updatedSpecific = await model.findOneAndUpdate(
                { [idField]: memberId },
                { $set: roleUpdates },
                { new: true, runValidators: true, session }
            );
        } else {
            // Fetch pour pouvoir le retourner même s'il n'y a pas de mise à jour spécifique au rôle
            updatedSpecific = await model.findOne({ [idField]: memberId }).session(session);
        }

        // 4. Commit DB Transaction FIRST
        await session.commitTransaction();

        // 5. Cleanup: Now that DB is safe, destroy the old Cloudinary image
        if (oldPhotoToDelete) {
            try {
                // Extraction du véritable public_id grâce à la fonction utilitaire
                const publicId = getCloudinaryPublicId(oldPhotoToDelete);
                await cloudinary.uploader.destroy(publicId);
                console.log(`Ancienne image supprimée avec succès : ${publicId}`);
            } catch (err) {
                console.error("Échec de la suppression de l'ancienne image (Fichier orphelin):", err);
                // On ne lève pas d'erreur ici car la DB a bien été mise à jour
            }
        }

        // 6. Return response using the updated data
        return res.status(200).json({
            status: "success",
            message: `Profil ${roleName} mis à jour avec succès.`,
            data: {
                user: updatedUser,
                details: updatedSpecific
            }
        });

    } catch (error) {
        // DB Rollback
        await session.abortTransaction();

        // 7. Cleanup NEW image if transaction failed
        // Permet d'éviter de stocker des fichiers inutiles si l'enregistrement DB a échoué
        const newFilePublicId = req.file?.filename || req.file?.public_id;
        if (newFilePublicId) {
            try {
                await cloudinary.uploader.destroy(newFilePublicId);
            } catch (e) {
                console.error("Erreur lors de la suppression de la nouvelle image annulée :", e);
            }
        }

        console.error("UPDATE ERROR:", error);
        return res.status(500).json({
            status: "error",
            message: error?.message || "Erreur serveur"
        });

    } finally {
        session.endSession();
    }
};

/* ---------------------------------------------------- */
/* ROLE ROUTES                                          */
/* ---------------------------------------------------- */

exports.updateProfileTeacher = async (req, res) => {
    return await performUpdate(req, res, {
        model: Teacher,
        idField: "id_enseignant",
        roleName: "enseignant",
        allowedFields: [
            "nature",
            "latitude",
            "longitude",
            "deplacement",
            "rayon_deplacement",
            "description_pedagogique",
            "certifications",
            "actif",
            "subjects"
        ]
    });
};

exports.updateProfileStudent = async (req, res) => {
    return await performUpdate(req, res, {
        model: Student,
        idField: "id_eleve",
        roleName: "étudiant",
        allowedFields: [
            "yearOfStudy",
            "niveau_scolaire",
            "objectifs_pedagogiques",
            "id_parent"
        ]
    });
};

exports.updateProfileParent = async (req, res) => {
    return await performUpdate(req, res, {
        model: Parent,
        idField: "id_parent",
        roleName: "parent",
        allowedFields: [
            "enfants"
        ]
    });
};

/* backward compatibility */
exports.updateProfile = exports.updateProfileTeacher;