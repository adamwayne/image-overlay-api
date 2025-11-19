import Jimp from "jimp";
import { v4 as uuidv4 } from "uuid";
import path from "path";

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
      y_percent = 50
    } = req.body;

    if (!design_url || !background_url) {
      return res.status(400).json({ error: "Missing URLs" });
    }

    console.log("🔗 Using URLs:", { design_url, background_url });

    // Load both images
    const background = await Jimp.read(background_url);
    const design = await Jimp.read(design_url);

    // Resize the design
    const finalWidth = Math.round(background.bitmap.width * (width_percent / 100));
    design.resize(finalWidth, Jimp.AUTO);

    // Centered placement
    const x = Math.round(background.bitmap.width * (x_percent / 100) - design.bitmap.width / 2);
    const y = Math.round(background.bitmap.height * (y_percent / 100) - design.bitmap.height / 2);

    background.composite(design, x, y);

    // Save to /tmp
    const id = uuidv4();
    const filepath = path.join("/tmp", `${id}.png`);
    await background.writeAsync(filepath);

    const publicUrl = `${req.headers.host}/api/fetch-image?id=${id}`;

    console.log("🟢 Returning URL:", publicUrl);

    // IMPORTANT → must be full https URL
    return res.status(200).json({
      image_url: `https://${publicUrl}`,
      id
    });

  } catch (error) {
    console.error("❌ Composite Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
