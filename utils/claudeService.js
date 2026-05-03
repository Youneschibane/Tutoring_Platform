const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/complete';
const AI_MODEL = 'claude-3.5-mini';

if (!ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not configured. Claude requests will fail until the environment variable is set.');
}

const buildPrompt = (instruction, payload) => {
  return `Human: ${instruction}\n\n${payload}\n\nAssistant:`;
};

const parseJson = (rawText) => {
  const trimmed = rawText.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (innerError) {
        throw new Error(`Impossible de parser la réponse JSON de Claude. Réponse brute : ${trimmed}`);
      }
    }

    throw new Error(`Impossible de parser la réponse JSON de Claude. Réponse brute : ${trimmed}`);
  }
};

const callClaude = async (prompt, maxTokens = 700, temperature = 0.2) => {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('La clé ANTHROPIC_API_KEY n\'est pas définie.');
  }

  const body = JSON.stringify({
    model: AI_MODEL,
    prompt,
    max_tokens_to_sample: maxTokens,
    temperature,
    stop_sequences: ['\n\nHuman:']
  });

  const response = await new Promise((resolve, reject) => {
    const req = https.request(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Claude API status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const parsed = JSON.parse(response);
  return parsed.completion || parsed?.completion?.[0] || parsed?.response || '';
};

const classificationPrompt = `You are an expert educational evaluator. Analyze the provided teacher document text and return ONLY valid JSON with these keys:
- category: one of \"Support de cours\", \"Exercice\", \"Correction\", \"Autre\"
- subjects: array of core subjects mentioned in the document
- gradeLevel: one of \"Primaire\", \"Moyen\", \"Lycée\", \"Universitaire\", or \"Non déterminé\"
- language: the primary language of the text
- safety: one of \"safe\", \"needs_review\", \"not_allowed\"
- summary: a short one-sentence summary of the document content
Do not add any explanation outside the JSON object.`;

const analysisPrompt = `You are an AI assistant for teacher-created learning content. Based on the document text and its classification, return ONLY valid JSON with these keys:
- suggestedTitle: a concise title for the document
- summary: a 2-3 sentence pedagogical summary
- keywords: array of the most important keywords
- recommendedSubjects: array of recommended subject tags
- recommendedUse: suggested classroom or homework use
- safetyNotes: any content restrictions or moderation notes
- language: the primary language of the document
- documentType: the most appropriate label for the file
Do not add any explanation outside the JSON object.`;

exports.CLASSIFICATION_PROMPT = classificationPrompt;
exports.ANALYSIS_PROMPT = analysisPrompt;

exports.classifyDocument = async (text, metadata = {}) => {
  const payload = [`Document name: ${metadata.originalName || 'N/A'}`,
    `Mimetype: ${metadata.mimeType || 'unknown'}`,
    `Teacher: ${metadata.teacherName || 'unknown'}`,
    'Document text:',
    text || 'Aucun texte détecté.']
    .join('\n');

  const prompt = buildPrompt(classificationPrompt, payload);
  const raw = await callClaude(prompt, 700, 0.1);
  const parsed = parseJson(raw);

  return {
    ...parsed,
    raw
  };
};

exports.generateDocumentAnalysis = async (text, classification, metadata = {}) => {
  const classificationSummary = JSON.stringify(classification, null, 2);
  const payload = [`Document name: ${metadata.originalName || 'N/A'}`,
    `Mimetype: ${metadata.mimeType || 'unknown'}`,
    `Teacher: ${metadata.teacherName || 'unknown'}`,
    `Classification: ${classificationSummary}`,
    'Document text:',
    text || 'Aucun texte détecté.']
    .join('\n');

  const prompt = buildPrompt(analysisPrompt, payload);
  const raw = await callClaude(prompt, 800, 0.2);
  const parsed = parseJson(raw);

  return {
    ...parsed,
    raw
  };
};
