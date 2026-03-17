const mongoose = require('mongoose');
const path = require('path');
// Charge le fichier .env qui est dans le dossier parent
require('dotenv').config({ path: path.resolve(__dirname, '../.gitignore') });
const mongoURI = process.env.MONGO_URI;
const Education = require('../models/educationModel');

const Data = [
  // -------------------------------------------------------------------------
  { cycle: "Primaire", level: 1, levelName: "1AP", subjects: ["Arabe", "Mathématiques", "Éducation Islamique"] },
  { cycle: "Primaire", level: 2, levelName: "2AP", subjects: ["Arabe", "Mathématiques", "Éducation Islamique"] },
  { cycle: "Primaire", level: 3, levelName: "3AP", subjects: ["Arabe", "Mathématiques", "Français", "Éducation Islamique", "Sciences"] },
  { cycle: "Primaire", level: 4, levelName: "4AP", subjects: ["Arabe", "Mathématiques", "Français", "Anglais", "Sciences", "Histoire-Géo", "Éducation Islamique"] },
  { cycle: "Primaire", level: 5, levelName: "5AP", subjects: ["Arabe", "Mathématiques", "Français", "Anglais", "Sciences", "Histoire-Géo", "Éducation Islamique"] },

  // -------------------------------------------------------------------------
  { cycle: "Moyen", level: 1, levelName: "1AM", subjects: ["Arabe", "Français", "Anglais", "Mathématiques", "SVT", "Physique", "Histoire-Géo", "Éducation Islamique", "Informatique"] },
  // -------------------------------------------------------------------------
  { cycle: "Secondaire", level: 1, levelName: "1AS", specialty: "Sciences et Technologies", subjects: ["Mathématiques", "Physique", "SVT", "Arabe", "Français", "Anglais", "Histoire-Géo", "Informatique" ,"Génie Civil" , "Éducation Islamique", "Technologie"] },
  { cycle: "Secondaire", level: 1, levelName: "1L", specialty: "Lettres", subjects: ["Mathématiques", "Physique", "SVT", "Arabe", "Français", "Anglais", "Histoire-Géo", "Informatique" ] },
  { 
    cycle: "Secondaire", level: 2, levelName: "2ASS", specialty: "Sciences Expérimentales", 
    subjects: ["SVT", "Physique", "Mathématiques", "Arabe", "Français", "Anglais", "Histoire-Géo"] 
  },
  { 
    cycle: "Secondaire", level: 2, levelName: "2ASM", specialty: "Mathématiques", 
    subjects: ["Mathématiques", "Physique", "SVT", "Arabe", "Français", "Anglais"] 
  },
  { 
    cycle: "Secondaire", level: 2, levelName: "2ASTM", specialty: "Technique Math", 
    subjects: ["Mathématiques", "Physique", "Génie Civil", "Génie Mécanique", "Génie Électrique", "Génie des Procédés" ] 
  },
  { cycle: "Secondaire", level: 2, levelName: "2ASGE", specialty: "Gestion et Économie", 
    subjects: ["Arabe", "Histoire-Géo", "Français", "Anglais" , "Droit" , "Économie et Management" , "Comptabilité et Gestion Financière"] 
  },  
  { cycle: "Secondaire", level: 2, levelName: "2SLP", specialty: "Lettres et Philosophie", 
    subjects: ["Philosophie", "Arabe", "Histoire-Géo", "Français", "Anglais"] 
  },
  { cycle: "Secondaire", level: 2, levelName: "2SLE", specialty: "Lettres et Philosophie", 
    subjects: ["Philosophie", "Arabe", "Histoire-Géo", "Français", "Anglais" , "Espagnol" , "Allemand " , "Italien"] 
  },  { 
    cycle: "Secondaire", level: 2, levelName: "3ASS", specialty: "Sciences Expérimentales", 
    subjects: ["SVT", "Physique", "Mathématiques", "Arabe", "Français", "Anglais", "Histoire-Géo", "Philosophie"] 
  },
  { 
    cycle: "Secondaire", level: 3, levelName: "3ASM", specialty: "Mathématiques", 
    subjects: ["Mathématiques", "Physique", "SVT", "Arabe", "Français", "Anglais", "Philosophie"] 
  },
  { 
    cycle: "Secondaire", level: 3, levelName: "3ASTM", specialty: "Technique Math", 
    subjects: ["Mathématiques", "Physique", "Génie Civil", "Génie Mécanique", "Génie Électrique", "Génie des Procédés", "Philosophie" ] 
  },
  { 
    cycle: "Secondaire", level: 3, levelName: "3ASGE", specialty: "Gestion et Économie", 
    subjects: [ "Arabe", "Histoire-Géo", "Français", "Anglais" , "Droit" , "Économie et Management" , "Comptabilité et Gestion Financière", "Philosophie"] 
  },  
  { cycle: "Secondaire", level: 3, levelName: "3SLP", specialty: "Lettres et Philosophie", 
    subjects: ["Philosophie", "Arabe", "Histoire-Géo", "Français", "Anglais"] 
  },
  { cycle: "Secondaire", level: 3, levelName: "3SLE", specialty: "Lettres et Philosophie", 
    subjects: ["Philosophie", "Arabe", "Histoire-Géo", "Français", "Anglais" , "Espagnol" , "Allemand " , "Italien"] 
  }
];

const initiliseDB = async () => {
  try {
    if (!mongoURI) {
      throw new Error("MONGO_URI n'est pas défini dans le fichier .env");
    }

    await mongoose.connect(mongoURI);
    console.log("Connexion à MongoDB réussie.");

    await Education.deleteMany({});
    console.log("Anciennes données supprimées.");

    await Education.insertMany(Data); 
    
    console.log(" Base de données initialisée avec succès !");
    process.exit(0);
  } catch (err) {
    console.error("Erreur :", err.message);
    process.exit(1);
  }
};
initiliseDB();