const http = require('http');
const data = JSON.stringify({
  niveau_concerne: "Primaire",
  type_service: "Groupe",
  rating: { min: 4 },
  prix: { min: 400, max: 3000 }
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/search/services',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
