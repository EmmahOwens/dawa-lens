import { chatWithDawaGPT } from './src/services/aiService.js';
(async () => {
  try {
    const res = await chatWithDawaGPT({
      messages: [{ role: 'user', text: 'Hello' }],
      medicines: [],
      userProfile: { name: 'Test' },
      doseLogs: []
    });
    console.log("SUCCESS:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("ERROR:", err.message);
    if (err.response) {
      console.error("DATA:", err.response.data);
    }
    console.error(err);
  }
})();
