import Jimp from "jimp";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { loadImageBuffer } from "./fetch-image.js"; // <-- matches final loader

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      design_url,
      background_url,
      width_percent = 35,
      x_percent = 50,
      y_percent = 40
    } = req.body;

    if (!design_url) return res.status(400).json({ error: "Missing design_url" });
    if (!background_url) return res.status(400).json({ error: "Missing background_url" });

    console.log("🎨 DESIGN:", design_url);
    console.log("🖼 BACKGROUND:", background_url);

    // 🔥 Load both images as buffers
    const [designBuffer, backgroundBuffer] = await Promise.all([
      loadImageBuffer(design_url),
      loadImageBuffer(background_url)
    ]);

    // 🔥 Decode into Jimp images
    const design = await Jimp.read(designBuffer);
    const background = await Jimp.read(backgroundBuffer);

    // 🔥 Resize design proportionally
    const targetWidth = Math.round(background.bitmap.width * (width_percent / 100));
    design.resize(targetWidth, Jimp.AUTO);

    // 🔥 Position
    const x = Math.round((background.bitmap.width * (x_percent / 100)) - (design.bitmap.width / 2));
    const y = Math.round((background.bitmap.height * (y_percent / 100)) - (design.bitmap.height / 2));

    // 🔥 Composite
    background.composite(design, x, y);

    // 🔥 Save to tmp
    const id = uuidv4();
    const tmpPath = path.join("/tmp", `${id}.png`);
    await background.writeAsync(tmpPath);

    // 🔥 Public URL (points to fetch-image.js)
    const host = req.headers.host;
    const finalUrl = `https://${host}/api/fetch-image?id=${id}`;

    console.log("🔥 FINAL URL:", finalUrl);

    return res.status(200).json({
      success: true,
      image_url: finalUrl
    });

  } catch (err) {
    console.error("❌ Composite Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
