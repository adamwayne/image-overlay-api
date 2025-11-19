import sharp from "sharp";
import fetchImage from "./fetch-image.js";

export default async function handler(req, res) {
  try {
    const {
      design_url,
      background_url,
      width_percent = 50,
      x_percent = 50,
      y_percent = 50
    } = req.body || {};

    if (!design_url || !background_url) {
      return res.status(400).json({ error: "Missing URLs" });
    }

    // Load images
    const bgBuffer = await fetchImage(background_url);
    const bg = sharp(bgBuffer);
    const bgMeta = await bg.metadata();

    const targetWidth = Math.round((bgMeta.width * Number(width_percent)) / 100);

    const designBuffer = await fetchImage(design_url);
    const resized = await sharp(designBuffer)
      .resize({ width: targetWidth })
      .toBuffer();

    const x = Math.round((bgMeta.width * Number(x_percent)) / 100);
    const y = Math.round((bgMeta.height * Number(y_percent)) / 100);

    const final = await bg
      .composite([{ input: resized, left: x, top: y }])
      .png()
      .toBuffer();

    return res.status(200).json({
      success: true,
      image_url: `data:image/png;base64,${final.toString("base64")}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
