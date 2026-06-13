import { identifyPill } from './src/services/visionService.js';
(async () => {
  try {
    const res = await identifyPill(null, "30", "Panadol Extra 500mg paracetamol / 65mg caffeine");
    console.log("SUCCESS:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("ERROR:", err.message);
    if (err.response) {
      console.error("DATA:", err.response.data);
    }
  }
})();
