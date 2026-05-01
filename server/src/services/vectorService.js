import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Retrieves relevant medical knowledge snippets from Firestore Vector Search.
 * Uses text-embedding-004 for generating query embeddings.
 * 
 * @param {string} query - The user's question or search term.
 * @param {number} limit - Number of snippets to retrieve.
 * @returns {Promise<string[]>} - Array of medical knowledge strings.
 */
export const retrieveMedicalKnowledge = async (query, limit = 3) => {
  if (!query || query.length < 3) return [];
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️ GEMINI_API_KEY not found. Skipping medical knowledge retrieval.');
      return [];
    }

    // 1. Generate embedding for the query
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(query);
    const embedding = result.embedding.values;

    if (!embedding || embedding.length === 0) {
      console.warn('⚠️ Failed to generate embedding for query:', query);
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
