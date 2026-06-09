import { identifyPill } from './src/services/visionService.js';
(async () => {
  try {
    const res = await identifyPill("data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "30");
    console.log("SUCCESS:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("ERROR:", err.message);
    if (err.response) {
      console.error("DATA:", err.response.data);
    }
  }
})();
