import Jimp from "jimp";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fetchDropboxImage } from "./utils/dropboxFetch.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { design_url, background_url } = req.body;

    if (!design_url || !background_url) {
      return res.status(400).json({ error: "Missing design_url or background_url" });
    }

    console.log("🎨 Fetching design...");
    const designBuf = await fetchDropboxImage(design_url);

    console.log("🖼 Fetching background...");
    const bgBuf = await fetchDropboxImage(background_url);

    const design = await Jimp.read(designBuf);
    const background = await Jimp.read(bgBuf);

    // Resize design to reasonable size
    const targetWidth = background.bitmap.width * 0.35; // tweakable %
    design.resize(targetWidth, Jimp.AUTO);

    const x = background.bitmap.width / 2 - design.bitmap.width / 2;
    const y = background.bitmap.height / 2 - design.bitmap.height / 2;

    background.composite(design, x, y);

    const id = uuidv4();
    const filePath = path.join("/tmp", `${id}.png`);
    await background.writeAsync(filePath);

    const absolute = `https://${req.headers.host}/api/fetch-image?id=${id}`;
    console.log("🚀 Returning:", absolute);

    return res.status(200).json({ success: true, image_url: absolute });

  } catch (err) {
    console.error("❌ Composite Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
