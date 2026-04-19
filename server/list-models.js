import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    const res = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });
    console.log(res.data.data.map(m => m.id).join('\n'));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
})();
