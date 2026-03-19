const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Gestion des contrats',
    description: 'Documentation des contrats pour le Front-end',
  },
  host: 'localhost:3000',
  schemes: ['http'],
};

const outputFile = './swagger-output.json'; 
const endpointsFiles = ['./app.js'];

swaggerAutogen(outputFile, endpointsFiles).then(() => {
    console.log("Contrats générés avec succès dans swagger-output.json");
});
