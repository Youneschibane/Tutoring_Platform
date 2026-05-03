const https = require('https');
const http = require('http');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const downloadFileBuffer = (url) => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;

    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Impossible de télécharger le document. Statut HTTP : ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
};

const extractTextFromPdf = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text ? data.text.trim() : '';
};

const extractTextFromDocx = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ? result.value.trim() : '';
};

const extractTextFromImage = async () => {
  return 'Le fichier est une image. L’extraction de texte depuis une image n’est pas encore supportée par cette version du service. Veuillez privilégier un PDF ou un DOCX pour l’analyse IA.';
};

exports.extractTextFromRemoteDocument = async (url, mimeType) => {
  const buffer = await downloadFileBuffer(url);

  if (mimeType === 'application/pdf') {
    return extractTextFromPdf(buffer);
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(buffer);
  }

  if (mimeType === 'application/msword') {
    try {
      return await extractTextFromDocx(buffer);
    } catch (error) {
      return 'Le document Word n’a pas pu être converti automatiquement. Veuillez exporter en DOCX ou PDF pour l’analyse IA.';
    }
  }

  if (mimeType.startsWith('image/')) {
    return extractTextFromImage();
  }

  return 'Le format de document n’est pas pris en charge pour l’extraction de texte automatique. Veuillez utiliser un PDF ou un DOCX.';
};
