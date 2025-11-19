import Jimp from "jimp";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      type,
      design_url,
      background_url,
      width_percent = 50,
      x_percent = 50,
      y_percent = 50,
      canvas_width = 4200,
      canvas_height = 4800,
      webhook_url,
      metadata
    } = req.body;

    if (!design_url || !background_url) {
      return res.status(400).json({ error: "Missing required URLs" });
    }

    // Load images
    const [background, design] = await Promise.all([
      Jimp.read(background_url),
      Jimp.read(design_url)
    ]);

    // Resize design
    const targetWidth = Math.round((background.bitmap.width * width_percent) / 100);
    design.resize(targetWidth, Jimp.AUTO);

    // Position design
    const x = Math.round((background.bitmap.width * x_percent) / 100 - design.bitmap.width / 2);
    const y = Math.round((background.bitmap.height * y_percent) / 100 - design.bitmap.height / 2);

    background.composite(design, x, y);

    // Generate image ID + save to tmp
    const imageId = uuidv4();
    const outPath = path.join("/tmp", `${imageId}.png`);
    await background.writeAsync(outPath);

    // Build URL to fetch-image API
    const imageUrl = `https://${req.headers.host}/api/fetch-image?id=${imageId}`;

    // Send webhook if requested
    if (webhook_url) {
      await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          metadata
        })
      });
    }

    return res.status(200).json({
      success: true,
      image_url: imageUrl
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
