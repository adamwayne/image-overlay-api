import Jimp from "jimp";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * Bulletproof Dropbox URL sanitizer
 * - Forces dl.dropboxusercontent.com
 * - Removes all params
 * - Enforces ?dl=1
 */
function sanitizeDropboxUrl(url) {
  if (!url) return url;
  url = url.trim();

  url = url
    .replace("www.dropbox.com", "dl.dropboxusercontent.com")
    .replace("dropbox.com", "dl.dropboxusercontent.com");

  const clean = url.split("?")[0];
  return clean + "?dl=1";
}

/**
 * Safe image loader
 * - Downloads the file manually
 * - Detects Dropbox HTML pages
 * - Saves locally then loads via Jimp
 */
async function loadImage(url, label = "file") {
  const safeUrl = sanitizeDropboxUrl(url);

  const resp = await fetch(safeUrl);

  const contentType = resp.headers.get("content-type") || "";
  const buf = await resp.buffer();

  if (contentType.includes("html")) {
    throw new Error(`❌ Dropbox returned HTML instead of image for ${label}.
URL: ${safeUrl}`);
  }

  const tmpPath = `/tmp/${label}-${uuidv4()}.png`;
  fs.writeFileSync(tmpPath, buf);

  return await Jimp.read(tmpPath);
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
      webhook_url,
      metadata
    } = req.body;

    if (!design_url) {
      return res.status(400).json({ error: "Missing design_url" });
    }

    // Sanitize & load design
    const design = await loadImage(design_url, "design");

    let background = null;
    if (type !== "print") {
      if (!background_url) {
        return res.status(400).json({ error: "Missing background_url" });
      }
      background = await loadImage(background_url, "background");
    }

    let finalImage = null;

    if (type === "print") {
      // Print mode: 4200 × 4800
      const canvas = new Jimp(4200, 4800, 0x00000000);

      const dx = design.bitmap.width;
      const dy = design.bitmap.height;
      const targetAspect = 4200 / 4800;
      const designAspect = dx / dy;

      let newW, newH;
      if (designAspect > targetAspect) {
        newW = 4200;
        newH = Math.round(newW / designAspect);
      } else {
        newH = 4800;
        newW = Math.round(newH * designAspect);
      }

      design.resize(newW, newH);

      const cx = Math.round((4200 - newW) / 2);
      const cy = Math.round((4800 - newH) / 2);

      canvas.composite(design, cx, cy);
      finalImage = canvas;
    } else {
      // Display mode
      const targetWidth = Math.round(
        (background.bitmap.width * width_percent) / 100
      );

      design.resize(targetWidth, Jimp.AUTO);

      const posX = Math.round(
        background.bitmap.width * (x_percent / 100) - design.bitmap.width / 2
      );
      const posY = Math.round(
        background.bitmap.height * (y_percent / 100) - design.bitmap.height / 2
      );

      background.composite(design, posX, posY);
      finalImage = background;
    }

    // Write output file
    const id = uuidv4();
    const outPath = `/tmp/${id}.png`;
    await finalImage.writeAsync(outPath);

    const finalUrl = `https://${req.headers.host}/api/fetch-image?id=${id}`;

    // Optional webhook callback
    if (webhook_url) {
      await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: finalUrl,
          metadata
        })
      });
    }

    return res.status(200).json({
      success: true,
      image_url: finalUrl
    });
  } catch (err) {
    console.error("❌ composite.js error:", err);
    return res.status(500).json({ error: err.message });
  }
}
