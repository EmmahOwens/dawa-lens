import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const getGeminiApiKey = () => process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;
const getVoyageApiKey = () => process.env.VOYAGEAI_API || process.env.VOYAGE_API_KEY;

/**
 * Generates text embeddings using Voyage AI (voyage-3-lite).
 * @param {string} text - Text to embed.
 * @returns {Promise<number[]|null>} Array of floats or null.
 */
export const generateVoyageEmbedding = async (text) => {
  const apiKey = getVoyageApiKey();
  if (!apiKey || !text) return null;

  try {
    const response = await axios.post(
      'https://api.voyageai.com/v1/embeddings',
      {
        input: [text],
        model: 'voyage-3-lite'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 6000
      }
    );

    const embedding = response.data?.data?.[0]?.embedding;
    return Array.isArray(embedding) && embedding.length > 0 ? embedding : null;
  } catch (err) {
    console.warn('⚠️ Voyage AI (voyage-3-lite) embedding failed:', err.message);
    return null;
  }
};

/**
 * Generates text embeddings using Gemini text-embedding-004.
 * @param {string} text - Text to embed.
 * @returns {Promise<number[]|null>} Array of floats (768-dim) or null.
 */
export const generateGeminiEmbedding = async (text) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey || !text) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding?.values || null;
  } catch (err) {
    console.warn('⚠️ Gemini text-embedding-004 embedding failed:', err.message);
    return null;
  }
};

/**
 * Diagnostic test specifically for Voyage AI provider
 */
export const testVoyageAiProvider = async () => {
  const apiKey = getVoyageApiKey();
  if (!apiKey) {
    return {
      status: 'not_configured',
      configured: false,
      message: 'VOYAGEAI_API (or VOYAGE_API_KEY) environment variable is not set.'
    };
  }

  const startTime = Date.now();
  try {
    const embedding = await generateVoyageEmbedding('Dawa Lens medication safety check');
    if (!embedding || embedding.length === 0) {
      throw new Error('Voyage AI returned empty embedding vector.');
    }
    return {
      status: 'healthy',
      configured: true,
      provider: 'Voyage AI (voyage-3-lite)',
      latencyMs: Date.now() - startTime,
      dimension: embedding.length
    };
  } catch (err) {
    return {
      status: 'error',
      configured: true,
      provider: 'Voyage AI (voyage-3-lite)',
      latencyMs: Date.now() - startTime,
      error: err.message
    };
  }
};

/**
 * Retrieves relevant medical knowledge snippets from Firestore Vector Search.
 * Uses Gemini text-embedding-004 (768-dim) as primary for Firestore 768-dim index,
 * with Voyage AI voyage-3-lite available as alternative embedding provider.
 * 
 * @param {string} query - The user's question or search term.
 * @param {number} limit - Number of snippets to retrieve.
 * @returns {Promise<string[]>} - Array of medical knowledge strings.
 */
export const retrieveMedicalKnowledge = async (query, limit = 3) => {
  if (!query || query.length < 3) return [];
  
  try {
    // 1. Generate 768-dim embedding matching Firestore medical_knowledge index
    let embedding = await generateGeminiEmbedding(query);

    // If Gemini is not set or failed, try Voyage AI
    if (!embedding || embedding.length === 0) {
      embedding = await generateVoyageEmbedding(query);
    }

    if (!embedding || embedding.length === 0) {
      console.warn('⚠️ No embedding provider available for query:', query);
      return [];
    }

    // 2. Query Firestore using vector search
    const collection = db.collection('medical_knowledge');
    
    // Using findNearest for vector search (Firestore Enterprise/Native mode)
    const snapshot = await collection.findNearest({
      vectorField: 'embedding',
      queryVector: embedding,
      distanceMeasure: 'COSINE',
      limit: limit
    }).get();

    if (snapshot.empty) {
      console.log('ℹ️ No medical knowledge matches found for query.');
      return [];
    }

    return snapshot.docs.map(doc => doc.data().content || doc.data().text || '');
  } catch (error) {
    console.error('❌ Error retrieving medical knowledge:', error.message);
    // Return empty array on error to allow the chat to continue without context
    return [];
  }
};
