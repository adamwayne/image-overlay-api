// ==============================================
// Bulletproof COMPOSITE API for Vercel
// Adam Wayne — Production Safe Edition
// ==============================================

import Jimp from 'jimp';
import fetch from 'node-fetch';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Ensures Vercel treats the body as JSON
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};

export default async function handler(req, res) {
  try {
    // ----------------------------------------------------
    // 1. Validate Method
    // ----------------------------------------------------
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ----------------------------------------------------
    // 2. Parse Body Safely
    // ----------------------------------------------------
    let body = req.body;
    if (!body || typeof body !== 'object') {
      try {
        body = JSON.parse(req.body);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
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
    } = body;

    // ----------------------------------------------------
    // 3. Validate Required Inputs
    // ----------------------------------------------------
    if (!design_url) return res.status(400).json({ error: 'Missing design_url' });
    if (!background_url && type !== 'print')
      return res.status(400).json({ error: 'Missing background_url' });

    console.log("🎨 Incoming request:", {
      type,
      design_url,
      background_url
    });

    // ----------------------------------------------------
    // 4. Load Images
    // ----------------------------------------------------
    const loadImage = async (url) => {
      try {
        return await Jimp.read(url);
      } catch (e) {
        console.error('❌ Failed to load', url, e.message);
        throw new Error(`Cannot load image URL: ${url}`);
      }
    };

    let resultImage;

    // ----------------------------------------------------
    // 5. PRINT MODE (full 4200x4800 DTG files)
    // ----------------------------------------------------
    if (type === 'print') {
      const design = await loadImage(design_url);

      const targetW = canvas_width || 4200;
      const targetH = canvas_height || 4800;

      const canvas = new Jimp(targetW, targetH, 0x00000000);

      const designAspect = design.bitmap.width / design.bitmap.height;
      const canvasAspect = targetW / targetH;

      let newW, newH;
      if (designAspect > canvasAspect) {
        newW = targetW;
        newH = Math.round(targetW / designAspect);
      } else {
        newH = targetH;
        newW = Math.round(targetH * designAspect);
      }

      design.resize(newW, newH);

      canvas.composite(
        design,
        Math.round((targetW - newW) / 2),
        Math.round((targetH - newH) / 2)
      );

      resultImage = canvas;
    }

    // ----------------------------------------------------
    // 6. DISPLAY MODE (mockups)
    // ----------------------------------------------------
    else {
      const background = await loadImage(background_url);
      const design = await loadImage(design_url);

      const targetW = Math.round((background.bitmap.width * width_percent) / 100);
      design.resize(targetW, Jimp.AUTO);

      const x = Math.round(background.bitmap.width * (x_percent / 100) - design.bitmap.width / 2);
      const y = Math.round(background.bitmap.height * (y_percent / 100));

      background.composite(design, x, y);

      resultImage = background;
    }

    // ----------------------------------------------------
    // 7. Save to /tmp
    // ----------------------------------------------------
    const imageId = uuidv4();
    const filepath = path.join('/tmp', `${imageId}.png`);

    await resultImage.writeAsync(filepath);

    const publicUrl = `https://${req.headers.host}/api/fetch-image?id=${imageId}`;

    console.log("📤 Generated Image URL:", publicUrl);

    // ----------------------------------------------------
    // 8. If webhook provided, POST back to Airtable
    // ----------------------------------------------------
    if (webhook_url) {
      await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: publicUrl,
          metadata: metadata || null
        })
      });

      return res.status(200).json({
        message: "Webhook delivered",
        image_url: publicUrl
      });
    }

    // ----------------------------------------------------
    // 9. Return the short URL
    // ----------------------------------------------------
    return res.status(200).json({
      success: true,
      image_url: publicUrl
    });

  } catch (err) {
    console.error("🔥 ERROR IN COMPOSITE:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
