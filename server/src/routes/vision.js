import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const VISION_API_KEY = process.env.VISION_API_KEY;

// POST /api/vision/pill-id
router.post('/pill-id', async (req, res) => {
  const { image } = req.body; // Expects base64 string without data:image prefix

  if (!image) {
    return res.status(400).json({ error: 'No image data provided' });
  }

  if (!VISION_API_KEY) {
    console.error('VISION_API_KEY not found in environment variables');
    return res.status(500).json({ error: 'Vision API not configured on server' });
  }

  try {
    const requestBody = {
      requests: [
        {
          image: {
            content: image.replace(/^data:image\/\w+;base64,/, ''),
          },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 10 },
            { type: 'TEXT_DETECTION', maxResults: 5 },
            { type: 'WEB_DETECTION', maxResults: 15 },
          ],
        },
      ],
    };

    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      requestBody
    );

    const data = response.data.responses[0];
    
    if (!data) {
      return res.status(500).json({ error: 'Empty response from Vision API' });
    }

    // Process results into a structured format for Dawa Lens
    const textAnnotations = data.textAnnotations || [];
    const webDetection = data.webDetection || {};
    const labelAnnotations = data.labelAnnotations || [];

    // Extract imprints from text
    const imprints = textAnnotations.length > 0 ? textAnnotations[0].description.split('\n').map(s => s.trim()).filter(s => s.length > 0) : [];

    // Identify potential drug names from web entities
    const potentialMatches = (webDetection.webEntities || [])
      .filter(entity => entity.description)
      .map(entity => ({
        name: entity.description,
        confidence: entity.score || 0.5,
      }))
      .slice(0, 5);

    // If we have an imprint but no clear name, we can return the imprint as a key for manual search
    res.json({
      success: true,
      matches: potentialMatches,
      imprints: imprints,
      labels: labelAnnotations.map(l => l.description),
      originalData: {
        webEntities: webDetection.webEntities,
        text: textAnnotations[0]?.description
      }
    });

  } catch (error) {
    console.error('Vision API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to process image with Vision AI' });
  }
});

export default router;
