import Jimp from "jimp";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    type,
    design_url,
    background_url,
    width_percent,
    x_percent,
    y_percent,
    canvas_width,
    canvas_height,
    webhook_url,
    metadata,
  } = req.body;

  try {
    // ---------- 1) Validate URLs ----------
    if (!design_url) {
      return res.status(400).json({ error: "Missing design_url" });
    }
    if (type !== "print" && !background_url) {
      return res.status(400).json({ error: "Missing background_url" });
    }

    // ---------- 2) Bulletproof Dropbox/S3/URL Loader ----------
    async function loadImage(url, label = "image") {
      const resp = await fetch(url);

      const contentType = resp.headers.get("content-type") || "";
      const textSample = await resp.clone().text(); // peek at body text

      // Detect HTML pages (Dropbox redirect, 404 pages, etc)
      if (
        contentType.includes("text/html") ||
        textSample.startsWith("<!DOCTYPE html") ||
        textSample.startsWith("<html")
      ) {
        throw new Error(
          `The URL for ${label} returned HTML instead of an image. This usually means the Dropbox link is not a direct download.`
        );
      }

      const buffer = Buffer.from(await resp.arrayBuffer());

      try {
        return await Jimp.read(buffer);
      } catch (err) {
        throw new Error(
          `Failed to decode ${label} as an image. (Likely not a PNG/JPEG or Dropbox gave a corrupted response.)`
        );
      }
    }

    // ---------- 3) Load Design + Background ----------
    let design = await loadImage(design_url, "design");

    let background = null;
    if (type !== "print") {
      background = await loadImage(background_url, "background");
    }

    let finalImage;

    // ---------- 4) PRINT MODE ----------
    if (type === "print") {
      const targetWidth = canvas_width || 4200;
      const targetHeight = canvas_height || 4800;
      const canvas = new Jimp(targetWidth, targetHeight, 0x00000000);

      const designAspect = design.bitmap.width / design.bitmap.height;
      const canvasAspect = targetWidth / targetHeight;

      let scaledWidth, scaledHeight;

      if (designAspect > canvasAspect) {
        scaledWidth = targetWidth;
        scaledHeight = Math.round(targetWidth / designAspect);
      } else {
        scaledHeight = targetHeight;
        scaledWidth = Math.round(targetHeight * designAspect);
      }

      design.resize(scaledWidth, scaledHeight);

      const x = Math.round((targetWidth - scaledWidth) / 2);
      const y = Math.round((targetHeight - scaledHeight) / 2);

      canvas.composite(design, x, y);
      finalImage = canvas;

    } else {
      // ---------- 5) DISPLAY MODE ----------
      const targetWidth = Math.round(
        (background.bitmap.width * width_percent) / 100
      );

      design.resize(targetWidth, Jimp.AUTO);

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

    // ---------- 6) Write to /tmp ----------
    const id = uuidv4();
    const filePath = path.join("/tmp", `${id}.png`);
    await finalImage.writeAsync(filePath);

    const imageUrl = `https://${req.headers.host}/api/fetch-image?id=${id}`;

    // ---------- 7) Optional Webhook ----------
    if (webhook_url) {
      await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, metadata }),
      });
    }

    return res.status(200).json({
      success: true,
      image_url: imageUrl,
    });
  } catch (err) {
    console.error("❌ Composite Error:", err.message);
    return res.status(500).json({
      error: err.message,
    });
  }
}
