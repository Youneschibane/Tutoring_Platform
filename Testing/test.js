const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { fakerFR: faker } = require("@faker-js/faker");

const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");
const Service = require("../models/serviceModel");


require('dotenv').config();

const app = require('../app');

const mongoURI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

console.log('Connecting to MongoDB...');

mongoose.connect(mongoURI)
  .then(() => {
    console.log('MongoDB connected');

    app.listen(PORT,"0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });

  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

//////////////////////////////////////////////////////////
// ENUMS
//////////////////////////////////////////////////////////

const NATURES = ["Independant", "Etablissement", "Center"];
const TYPES = ["Individuel", "Groupe", "Preparation_examen"];
const NIVEAUX = ["Primaire", "Collège", "Lycée", "Université"];
const MODALITES = ["online", "onsite", "both"];
const ROLES = ["parent", "student", "teacher"];

const MATIERES = [
  "math",
  "physique",
  "chimie",
  "anglais",
  "français",
  "informatique",
  "histoire",
  "SVT",
  "philosophie"
];

const SUBJECTS = [
  "math",
  "physique",
  "chimie",
  "anglais",
  "français",
  "informatique",
  "histoire",
  "SVT"
];

const CERTS = [
  "CAPES",
  "TEFL",
  "DALF",
  "Agrégation",
  "CCNA",
  "Aucune"
];

//////////////////////////////////////////////////////////
// PRICE RANGES
//////////////////////////////////////////////////////////

const priceRanges = {
  Primaire: [300, 800],
  Collège: [500, 1200],
  Lycée: [800, 2000],
  Université: [1500, 5000]
};

//////////////////////////////////////////////////////////
// GEO LOCATION (ALGIERS)
//////////////////////////////////////////////////////////

const randomAlgiersCoords = () => [
  faker.number.float({ min: 2.9, max: 3.2, fractionDigits: 4 }),
  faker.number.float({ min: 36.6, max: 36.9, fractionDigits: 4 })
];

//////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////

const pickRandom = (arr) =>
  arr[Math.floor(Math.random() * arr.length)];

const pickMultiple = (arr, n) =>
  faker.helpers.arrayElements(arr, n);

//////////////////////////////////////////////////////////
// USER GENERATOR
//////////////////////////////////////////////////////////

const generateUser = async (id, role) => {

  const hashedPassword = await bcrypt.hash("Password123", 12);

  return {
    idmembre: id,
    firstname: faker.person.firstName(),
    familyname: faker.person.lastName(),
    email: faker.internet.email(),
    password: hashedPassword,
    role,
    postaladr: faker.number.int({ min: 16000, max: 16099 }),
    numberphone: `05${faker.number.int({ min: 10000000, max: 99999999 })}`
  };

};

//////////////////////////////////////////////////////////
// TEACHER GENERATOR
//////////////////////////////////////////////////////////

const generateTeacher = (id) => {

  const subjects = pickMultiple(
    SUBJECTS,
    faker.number.int({ min: 1, max: 3 })
  );

  const reviews = faker.number.int({ min: 0, max: 200 });

  return {

    id_enseignant: id,

    nature: pickRandom(NATURES),

    location: {
      type: "Point",
      coordinates: randomAlgiersCoords()
    },

    deplacement: faker.datatype.boolean(),

    rayon_deplacement: faker.number.int({
      min: 1000,
      max: 30000
    }),

    description_pedagogique: faker.lorem.sentences(2),

    parcours_academique: faker.lorem.sentence(),

    experience_professionnelle:
      `${faker.number.int({ min: 1, max: 20 })} ans`,

    certifications: pickRandom(CERTS),

    actif: faker.datatype.boolean({ probability: 0.85 }),

    reviewsCount: reviews,

    rating:
      reviews === 0
        ? 0
        : faker.number.float({
            min: 3.5,
            max: 5,
            fractionDigits: 1
          }),

    online: faker.datatype.boolean(),

    subjects
  };

};

//////////////////////////////////////////////////////////
// SERVICE GENERATOR
//////////////////////////////////////////////////////////

const generateService = (id, teacher) => {

  const matiere = pickRandom(teacher.subjects);

  const niveau = pickRandom(NIVEAUX);

  const [minPrice, maxPrice] = priceRanges[niveau];

  let modalite;

  if (teacher.online && teacher.deplacement)
    modalite = pickRandom(MODALITES);

  else if (teacher.online)
    modalite = "online";

  else
    modalite = "onsite";

  return {

    id_service: id,

    id_enseignant: teacher.id_enseignant,

    nom_service: faker.lorem.words(3),

    type_service: pickRandom(TYPES),

    matiere,

    niveau_concerne: niveau,

    nombre_max_participants: faker.number.int({
      min: 1,
      max: 15
    }),

    prix: faker.number.int({
      min: minPrice,
      max: maxPrice
    }),

    duree_seance: pickRandom([
      30,
      45,
      60,
      90,
      120
    ]),

    description: faker.lorem.sentences(2),

    actif: faker.datatype.boolean({
      probability: 0.9
    }),

    modalite_service: modalite,

    date_creation: faker.date.between({
      from: "2023-01-01",
      to: "2024-12-31"
    })
  };

};

//////////////////////////////////////////////////////////
// MAIN SEED FUNCTION
//////////////////////////////////////////////////////////

const seed = async () => {

  try {

    await User.deleteMany({});
    await Teacher.deleteMany({});
    await Service.deleteMany({});

    console.log("Collections cleared");

    //////////////////////////////////////////////////
    // STUDENTS / PARENTS
    //////////////////////////////////////////////////

    const students = await Promise.all(

      Array.from({ length: 200 }, (_, i) =>
        generateUser(
          i + 1,
          pickRandom(["student", "parent"])
        )
      )

    );

    await User.insertMany(students);

    console.log("200 students/parents inserted");

    //////////////////////////////////////////////////
    // TEACHER USERS
    //////////////////////////////////////////////////

    const teacherUsers = await Promise.all(

      Array.from({ length: 50 }, (_, i) =>
        generateUser(201 + i, "teacher")
      )

    );

    await User.insertMany(teacherUsers);

    console.log("50 teacher users inserted");

    //////////////////////////////////////////////////
    // TEACHERS
    //////////////////////////////////////////////////

    const teachers = Array.from({ length: 50 }, (_, i) =>
      generateTeacher(201 + i)
    );

    await Teacher.insertMany(teachers);

    console.log("50 teachers inserted");

    //////////////////////////////////////////////////
    // SERVICES
    //////////////////////////////////////////////////

    let serviceId = 1;

    const services = [];

    for (const teacher of teachers) {

      const count = faker.number.int({
        min: 3,
        max: 6
      });

      for (let i = 0; i < count; i++) {

        services.push(
          generateService(serviceId++, teacher)
        );

      }

    }

    await Service.insertMany(services);

    console.log(`${services.length} services inserted`);

    console.log("Seed complete");

    process.exit();

  } catch (error) {

    console.error("Seed error:", error);

    process.exit(1);

  }

};

seed();