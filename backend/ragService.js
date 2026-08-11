const { QdrantClient } = require('@qdrant/js-client-rest');
const fs = require('fs');
const pdf = require('pdf-parse');
const officeParser = require('officeparser');

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

async function extractTextFromFile(filePath) {
  if (filePath.toLowerCase().endsWith('.pdf')) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } else {
    // officeparser natively returns a Promise for parseOffice
    try {
      const data = await officeParser.parseOffice(filePath);
      return data;
    } catch (error) {
      console.error("OfficeParser failed:", error);
      return "";
    }
  }
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
    console.log(`Processing file for session ${sessionId}: ${filePath}`);
    const text = await extractTextFromFile(filePath);
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

async function processAndIndexStructuredDocument(sessionId, docStructure) {
  try {
    console.log(`Processing structured presentation document for session ${sessionId}`);
    const chunks = [];

    // 1. Executive Summary Chunk
    if (docStructure.executive_summary) {
      chunks.push(
        `Presentation Title: ${docStructure.title || 'Untitled'}\nExecutive Summary:\n${docStructure.executive_summary}`
      );
    }

    // 2. Sections
    if (Array.isArray(docStructure.sections)) {
      for (const sec of docStructure.sections) {
        let secText = `Topic: ${sec.section_title || 'Section'} (Slide ${sec.slide_number || ''})\n`;
        
        if (Array.isArray(sec.paragraphs) && sec.paragraphs.length > 0) {
          secText += sec.paragraphs.map(p => p.text || p).join('\n') + '\n';
        }
        
        if (Array.isArray(sec.key_takeaways) && sec.key_takeaways.length > 0) {
          secText += 'Key Points:\n' + sec.key_takeaways.map(t => `- ${t}`).join('\n') + '\n';
        }

        if (Array.isArray(sec.diagram_callouts) && sec.diagram_callouts.length > 0) {
          secText += 'Visual / Diagram Insights:\n' + sec.diagram_callouts.map(d => `- ${d}`).join('\n') + '\n';
        }

        if (Array.isArray(sec.tables) && sec.tables.length > 0) {
          for (const tbl of sec.tables) {
            if (tbl.headers && tbl.rows) {
              secText += `Table Data: ${tbl.headers.join(' | ')}\n`;
              secText += tbl.rows.map(r => r.join(' | ')).join('\n') + '\n';
            }
          }
        }

        // Break section text into standard chunks if it's large
        const sectionSubChunks = chunkText(secText.trim(), 600, 80);
        chunks.push(...sectionSubChunks);
      }
    }

    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await getEmbedding(chunk);
      points.push({
        id: `${sessionId}-struct-${i}`,
        vector,
        payload: { sessionId, text: chunk, chunkIndex: i, isStructured: true }
      });
    }

    if (points.length > 0) {
      await qdrantClient.upsert(COLLECTION_NAME, {
        wait: true,
        points: points
      });
    }
    console.log(`Indexed ${points.length} structured chunks for session ${sessionId}`);
    return points.length;
  } catch (error) {
    console.error('Error in processAndIndexStructuredDocument:', error);
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
  processAndIndexStructuredDocument,
  searchContext
};


