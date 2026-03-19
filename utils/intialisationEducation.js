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
  },

  //---------------------------------------------------------------------------------------


  
  // ================= 1CP (1ère Année Classe Préparatoire) =================
  { 
    cycle: "ESI", level: 1, levelName: "1CP", specialty: "Tronc commun", 
    subjects: [
      "Algorithmique et Structures de Données 1", 
      "Architecture des Ordinateurs 1", 
      "Analyse Mathématique 1", 
      "Algèbre 1", 
      "Bureautique et web", 
      "Systèmes d'Exploitation 1", 
      "Anglais 1",
      "Algorithmique et Structures de Données 2", 
      "Architecture des Ordinateurs 2", 
      "Analyse Mathématique 2", 
      "Algèbre 2", 
      "Électricité", 
      "Electronique Fondamentale 1",
      "Anglais 2", "Français 2"
    ] 
  },

  // ================= 2CP (2ème Année Classe Préparatoire) =================
  { 
    cycle: "ESI", level: 2, levelName: "2CP", specialty: "Tronc commun", 
    subjects: [
      "Fichier et Structures de Données Dynamiques", 
      "Architecture des Ordinateurs 3", 
      "Analyse Mathématique 3", 
      "Algèbre 3", 
      "Logique Mathématique", 
      "Électronique Numérique", 
      "Économie d'Entreprise", 
      "Anglais 3",
      "Programmation Orientée Objet", 
      "Systèmes d'Information", 
      "Analyse Mathématique 4", 
      "Probabilités et Statistiques 1", 
      "Electronique Fondamentale 2",
      "Probabilités et Statistiques 2", 
      "Anglais 3"
    ] 
  },

  // ================= 1CS (1ère Année Cycle Supérieur) =================
  { 
    cycle: "ESI", level: 3, levelName: "1CS", specialty: "Tronc commun", 
    subjects: [
      "Théorie des Langages et Compilation", 
      "Réseaux de Communication", 
      "Systèmes d'Exploitation Centralisé", 
      "Théorie des Graphes", 
      "Analyse Numérique", 
      "Anglais 5",
      "Bases de Données", 
      "Génie Logiciel", 
      "Intelligence Artificielle", 
      "Interaction Homme-Machine", 
      "Recherche Opérationnelle", 
      "Sécurité Informatique", 
      "Management de l'Entreprise"
    ] 
  }, 
  { 
  cycle: "ESI", level: 4, levelName: "2CS", specialty: "SIQ", 
  subjects: [
    "Systèmes d'Exploitation Répartis",
    "Administration et Sécurité des Réseaux",
    "Conception des Systèmes de Calcul",
    "Vérification et Tests",
    "Modélisation et Évaluation de Performances ",
    "Optimisation Combinatoire",
    "Anglais 6",
    "Entrepreneuriat"
  ]},
  { 
  cycle: "ESI", level: 4, levelName: "2CS", specialty: "SID", 
  subjects: [
    "Systèmes de Gestion de Bases de Données ",
    "Entrepôts de Données ",
    "Fouille de Données ",
    "Recherche d'Information et Web Sémantique",
    "Big Data et Analyse de Données",
    "Administration des Bases de Données",
    "Anglais 6",
    "Entrepreneuriat"
  ]},
{ 
  cycle: "ESI", level: 4, levelName: "2CS", specialty: "SIL", 
  subjects: [
    "Architecture Logicielle (ARL)",
    "Vérification et Tests (V&T)",
    "Qualité du Logiciel",
    "Systèmes d'Information Décisionnels (BI)",
    "Développement Mobile et Web Avancé",
    "Processus de Développement Logiciel",
    "Anglais 6",
    "Entrepreneuriat"
  ]
} , { 
  cycle: "ESI", level: 4, levelName: "2CS", specialty: "SIT", 
  subjects: [
    "Audit des Systèmes d'Information",
    "Urbanisation des Systèmes d'Information",
    "Gouvernance des Systèmes d'Information",
    "Progiciels de Gestion Intégrés (ERP)",
    "E-Business et Marketing Digital",
    "Management de Projets de Systèmes d'Information",
    "Anglais 6",
    "Entrepreneuriat"
  ]
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