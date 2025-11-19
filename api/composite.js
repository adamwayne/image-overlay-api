import Jimp from "jimp";
import { v4 as uuidv4 } from "uuid";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      design_url,
      background_url,
      width_percent = 50,
      x_percent = 50,
      y_percent = 50,
      type = "display"
    } = req.body;

    if (!design_url || !background_url) {
      return res.status(400).json({ error: "Missing design or background URL" });
    }

    // Load images
    const background = await Jimp.read(background_url);
    const design = await Jimp.read(design_url);

    // Resize design
    const targetWidth = Math.round(
      (background.bitmap.width * Number(width_percent)) / 100
    );
    await design.resize(targetWidth, Jimp.AUTO);

    // Positioning
    const x = Math.round(
      background.bitmap.width * (Number(x_percent) / 100) -
        design.bitmap.width / 2
    );
    const y = Math.round(
      background.bitmap.height * (Number(y_percent) / 100) -
        design.bitmap.height / 2
    );

    // Composite
    background.composite(design, x, y);

    // Save to /tmp
    const id = uuidv4();
    const filename = `${id}.png`;
    const outputPath = path.join("/tmp", filename);

    await background.writeAsync(outputPath);

    // Return file URL pointing to fetch-image.js
    const url = `https://${req.headers.host}/api/fetch-image?id=${id}`;
    return res.json({ image_url: url });

  } catch (error) {
    console.error("Composite error:", error);
    return res.status(500).json({ error: error.message });
  }
}
