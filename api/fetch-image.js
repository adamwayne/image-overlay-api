import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing image ID' });
  }

  try {
    const imagePath = path.join('/tmp', `${id}.png`);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found or expired' });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(imageBuffer);

  } catch (error) {
    console.error('Error fetching image:', error);
    return res.status(500).json({ error: error.message });
  }
}
