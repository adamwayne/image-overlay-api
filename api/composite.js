import Jimp from 'jimp';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * REQUIRED FIX — without this, req.body is ALWAYS undefined on Vercel
 */
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    type,
    design_url,
    background_url,
    width_percent,
    x_percent,
    y_percent,
    canvas_width,
    canvas_height,
    webhook_url,
    metadata
  } = req.body;

  try {
    let finalImage;

    // -------------------------------
    // 🖨 PRINT MODE (DTG print files)
    // -------------------------------
    if (type === 'print') {
      const design = await Jimp.read(design_url);
      const targetWidth = canvas_width || 4200;
      const targetHeight = canvas_height || 4800;

      const canvas = new Jimp(targetWidth, targetHeight, 0x00000000);

      const designAspect = design.bitmap.width / design.bitmap.height;
      const canvasAspect = targetWidth / targetHeight;

      let scaledWidth, scaledHeight;
      if (designAspect > canvasAspect) {
        scaledWidth = targetWidth;
        scaledHeight = Math.round(targetWidth / designAspect);
      } else {
        scaledHeight = targetHeight;
        scaledWidth = Math.round(targetHeight * designAspect);
      }

      design.resize(scaledWidth, scaledHeight);

      const x = Math.round((targetWidth - scaledWidth) / 2);
      const y = Math.round((targetHeight - scaledHeight) / 2);

      canvas.composite(design, x, y);
      finalImage = canvas;

    } else {
      // -------------------------------
      // 🎨 DISPLAY MODE (mockups)
      // -------------------------------
      const [background, design] = await Promise.all([
        Jimp.read(background_url),
        Jimp.read(design_url)
      ]);

      const targetWidth = Math.round((background.bitmap.width * width_percent) / 100);
      design.resize(targetWidth, Jimp.AUTO);

      const x = Math.round((background.bitmap.width * x_percent) / 100 - design.bitmap.width / 2);
      const y = Math.round((background.bitmap.height * y_percent) / 100 - design.bitmap.height / 2);

      background.composite(design, x, y);
      finalImage = background;
    }

    // ----------------------------
    // 🗂 Save into /tmp 
    // ----------------------------
    const imageId = uuidv4();
    const tmpPath = path.join('/tmp', `${imageId}.png`);
    await finalImage.writeAsync(tmpPath);

    // Public URL (served by fetch-image.js)
    const imageUrl = `https://${req.headers.host}/api/fetch-image?id=${imageId}`;

    // ----------------------------
    // 🔔 Optional Webhook
    // ----------------------------
    if (webhook_url) {
      await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          metadata: metadata
        })
      });

      return res.status(200).json({
        message: 'Webhook sent',
        image_url: imageUrl
      });
    }

    return res.status(200).json({ image_url: imageUrl });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
