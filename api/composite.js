import Jimp from 'jimp';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

function isHTMLBuffer(buf) {
  if (!buf) return false;
  const txt = buf.toString('utf8');
  return txt.startsWith('<!DOCTYPE html>') || txt.startsWith('<html');
}

async function loadImageSafe(url, label) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`${label} download failed: ${res.status}`);
  }

  const buf = await res.buffer();

  if (isHTMLBuffer(buf)) {
    throw new Error(`${label} is HTML (Dropbox redirect). URL is NOT a direct file: ${url}`);
  }

  try {
    return await Jimp.read(buf);
  } catch (e) {
    throw new Error(`${label} is not a supported image: ${url}`);
  }
}

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

  if (!design_url || !background_url) {
    return res.status(400).json({ error: 'Missing URLs' });
  }

  try {
    // Load images safely (no base64)
    const design = await loadImageSafe(design_url, "Design");
    const background = await loadImageSafe(background_url, "Background");

    // Display mode (the one you are using)
    const targetWidth = Math.round((background.bitmap.width * width_percent) / 100);
    design.resize(targetWidth, Jimp.AUTO);

    const x = Math.round((background.bitmap.width * x_percent) / 100 - design.bitmap.width / 2);
    const y = Math.round((background.bitmap.height * y_percent) / 100 - design.bitmap.height / 2);

    background.composite(design, x, y);

    const finalImage = background;

    const id = uuidv4();
    const tmpPath = path.join('/tmp', `${id}.png`);

    await finalImage.writeAsync(tmpPath);

    const imageUrl = `https://${req.headers.host}/api/fetch-image?id=${id}`;

    return res.status(200).json({
      success: true,
      image_url: imageUrl
    });

  } catch (err) {
    console.error("❌ Composite error:", err);
    return res.status(500).json({ error: err.message });
  }
}
