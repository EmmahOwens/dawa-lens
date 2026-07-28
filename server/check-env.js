import dotenv from 'dotenv';
dotenv.config();

console.log('=== Backend Environment Variables Status ===');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
console.log('GROQ_API_KEY_2:', process.env.GROQ_API_KEY_2 ? 'Set' : 'Not set');
console.log('GROQ_API_KEY_3:', process.env.GROQ_API_KEY_3 ? 'Set' : 'Not set');
console.log('CEREBRAS_API_KEY:', process.env.CEREBRAS_API_KEY ? 'Set' : 'Not set');
console.log('Z_AI_API_KEY:', process.env.Z_AI_API_KEY ? 'Set' : 'Not set');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Not set');
console.log('GEMINI_API_KEY_2:', process.env.GEMINI_API_KEY_2 ? 'Set' : 'Not set');
console.log('CLOUDFLARE_API_KEY:', process.env.CLOUDFLARE_API_KEY ? 'Set' : 'Not set');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'Set' : 'Not set');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set');
console.log('============================================');
