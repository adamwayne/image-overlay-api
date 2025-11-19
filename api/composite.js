import Jimp from "jimp";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * Convert ANY Dropbox URL → real direct image URL
 */
function cleanDropboxUrl(url) {
  if (!url) return null;

  if (url.includes("dl.dropboxusercontent")) return url;

  return url
    .replace("www.dropbox.com", "dl.dropboxusercontent.com")
    .replace("dropbox.com", "dl.dropboxusercontent.com")
    .replace("?raw=1", "")
    .replace("&raw=1", "");
}

/**
 * Fetch and load image via Jimp with dropbox fix
 */
async function loadJimpImage(url) {
  const cleaned = cleanDropboxUrl(url);

  if (!cleaned) throw new Error(`Invalid URL: ${url}`);

  try {
    return await Jimp.read(cleaned);
  } catch (err) {
    console.error("❌ Jimp failed to load:", cleaned);
    throw new Error(`Failed to load image: ${cleaned}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      type = "display",
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

    if (!design_url) throw new Error("Missing design_url");
    if (!background_url && type === "display")
      throw new Error("Missing background_url for display mode");

    let finalImage;

    // ----- PRINT MODE -----
    if (type === "print") {
      const design = await loadJimpImage(design_url);

      const targetW = canvas_width;
      const targetH = canvas_height;

      // Transparent background canvas
      const canvas = new Jimp(targetW, targetH, 0x00000000);

      const designAspect = design.bitmap.width / design.bitmap.height;
      const canvasAspect = targetW / targetH;

      let scaledW, scaledH;

      if (designAspect > canvasAspect) {
        scaledW = targetW;
        scaledH = Math.round(targetW / designAspect);
      } else {
        scaledH = targetH;
        scaledW = Math.round(targetH * designAspect);
      }

      design.resize(scaledW, scaledH);

      const x = Math.round((targetW - scaledW) / 2);
      const y = Math.round((targetH - scaledH) / 2);

      canvas.composite(design, x, y);

      finalImage = canvas;
    }

    // ----- DISPLAY MODE -----
    else {
      const background = await loadJimpImage(background_url);
      const design = await loadJimpImage(design_url);

      const targetW = Math.round(
        (background.bitmap.width * width_percent) / 100
      );

      design.resize(targetW, Jimp.AUTO);

      const x = Math.round(
        (background.bitmap.width * x_percent) / 100 - design.bitmap.width / 2
      );
      const y = Math.round(
        (background.bitmap.height * y_percent) / 100 -
          design.bitmap.height / 2
      );

      background.composite(design, x, y);

      finalImage = background;
    }

    // ----- SAVE FILE TO /tmp -----
    const imageId = uuidv4();
    const tmpPath = path.join("/tmp", `${imageId}.png`);

    await finalImage.writeAsync(tmpPath);

    const finalUrl = `https://${req.headers.host}/api/fetch-image?id=${imageId}`;

    // ----- OPTIONAL WEBHOOK -----
    if (webhook_url) {
      try {
        await fetch(webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: finalUrl,
            metadata
          })
        });
      } catch (err) {
        console.error("❌ Webhook failed:", err);
      }
    }

    return res.status(200).json({
      image_url: finalUrl
    });
  } catch (error) {
    console.error("❌ Composite Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
