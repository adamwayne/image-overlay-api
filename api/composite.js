import Jimp from "jimp";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      design_url,
      background_url,
      width_percent = 50,
      x_percent = 50,
      y_percent = 50,
    } = req.body;

    if (!design_url || !background_url) {
      return res.status(400).json({ error: "Missing URLs" });
    }

    // Fetch images as buffers
    const designRes = await fetch(design_url);
    const bgRes = await fetch(background_url);

    if (!designRes.ok) return res.status(400).json({ error: "Bad design URL" });
    if (!bgRes.ok) return res.status(400).json({ error: "Bad background URL" });

    const designBuf = Buffer.from(await designRes.arrayBuffer());
    const bgBuf = Buffer.from(await bgRes.arrayBuffer());

    const design = await Jimp.read(designBuf);
    const background = await Jimp.read(bgBuf);

    // Resize design
    const newWidth = Math.round((background.bitmap.width * width_percent) / 100);
    design.resize(newWidth, Jimp.AUTO);

    const px = Math.round(
      background.bitmap.width * (x_percent / 100) - design.bitmap.width / 2
    );
    const py = Math.round(
      background.bitmap.height * (y_percent / 100) - design.bitmap.height / 2
    );

    background.composite(design, px, py);

    // Save to /tmp
    const id = uuidv4();
    const filePath = `/tmp/${id}.png`;
    await background.writeAsync(filePath);

    // Return a URL to fetch-image
    const finalUrl = `https://${req.headers.host}/api/fetch-image?id=${id}`;
    return res.status(200).json({ success: true, image_url: finalUrl });

  } catch (err) {
    console.error("COMPOSITE ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
