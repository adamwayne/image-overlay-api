import sharp from "sharp";
import fetchImage from "../utils/fetch-image";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const {
      design_url,
      background_url,
      width_percent = 50,
      x_percent = 50,
      y_percent = 50,
      type = "display"
    } = req.body || {};

    console.log("📦 Incoming body:", req.body);

    if (!design_url || !background_url) {
      return res.status(400).json({
        error: "Missing required fields: design_url, background_url"
      });
    }

    // Load background
    const bgBuffer = await fetchImage(background_url);
    const bg = sharp(bgBuffer);
    const bgMeta = await bg.metadata();

    // Compute placement
    const designTargetWidth = Math.round(
      (bgMeta.width * Number(width_percent)) / 100
    );

    if (!designTargetWidth || isNaN(designTargetWidth)) {
      return res.status(400).json({
        error: `Invalid width_percent: ${width_percent}`
      });
    }

    // Load + resize design
    const designBuffer = await fetchImage(design_url);
    const resizedDesign = await sharp(designBuffer)
      .resize({ width: designTargetWidth })
      .toBuffer();

    // Compute X/Y
    const x = Math.round((bgMeta.width * Number(x_percent)) / 100);
    const y = Math.round((bgMeta.height * Number(y_percent)) / 100);

    if ([x, y].some((v) => isNaN(v))) {
      return res.status(400).json({
        error: `Invalid x_percent or y_percent: ${x_percent}, ${y_percent}`
      });
    }

    // Composite
    const finalImage = await bg
      .composite([{ input: resizedDesign, left: x, top: y }])
      .png()
      .toBuffer();

    const base64 = finalImage.toString("base64");

    return res.status(200).json({
      success: true,
      image_url: `data:image/png;base64,${base64}`
    });
  } catch (err) {
    console.error("❌ Composite Error:", err);
    return res.status(500).json({
      error: err.message || "Unknown composite error"
    });
  }
}
