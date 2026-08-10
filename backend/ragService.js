const { QdrantClient } = require('@qdrant/js-client-rest');
const fs = require('fs');
const pdf = require('pdf-parse');

// Dynamic import for transformers to avoid CommonJS/ESM issues
let pipeline;
(async () => {
  const transformers = await import('@xenova/transformers');
  pipeline = transformers.pipeline;
})();

const qdrantClient = new QdrantClient({ url: process.env.QDRANT_URL || 'http://127.0.0.1:6333' });
const COLLECTION_NAME = 'presentations';

async function initQdrant() {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    if (!exists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: { size: 384, distance: 'Cosine' },
      });
      console.log(`Collection ${COLLECTION_NAME} created.`);
    }
  } catch (error) {
    console.error("Qdrant initialization error:", error);
  }
}

initQdrant();

async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function getEmbedding(text) {
  if (!pipeline) {
    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
  }
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function processAndIndexDocument(sessionId, filePath) {
  try {
    console.log(`Processing PDF for session ${sessionId}: ${filePath}`);
    const text = await extractTextFromPDF(filePath);
    const chunks = chunkText(text);

    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await getEmbedding(chunk);
      points.push({
        id: `${sessionId}-${i}`,
        vector,
        payload: { sessionId, text: chunk, chunkIndex: i }
      });
    }

    if (points.length > 0) {
      await qdrantClient.upsert(COLLECTION_NAME, {
        wait: true,
        points: points
      });
    }
    console.log(`Indexed ${points.length} chunks for session ${sessionId}`);
    return points.length;
  } catch (error) {
    console.error('Error in processAndIndexDocument:', error);
    throw error;
  }
}

async function searchContext(sessionId, queryText) {
  try {
    const vector = await getEmbedding(queryText);
    const results = await qdrantClient.search(COLLECTION_NAME, {
      vector,
      filter: {
        must: [{ key: 'sessionId', match: { value: sessionId } }]
      },
      limit: 3
    });
    
    return results.map(r => r.payload.text).join('\n\n');
  } catch (error) {
    console.error('Error searching context:', error);
    return '';
  }
}

module.exports = {
  processAndIndexDocument,
  searchContext
};
