import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing id' });
  }

  const filePath = path.join('/tmp', `${id}.png`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const buf = fs.readFileSync(filePath);

  res.setHeader('Content-Type', 'image/png');
  res.send(buf);
}
