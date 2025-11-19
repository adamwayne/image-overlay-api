import Jimp from "jimp";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

async function loadImageSafe(url) {
  if (!url) throw new Error("Missing image URL");

  const response = await fetch(url, { redirect: "follow" });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Detect PNG
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  // Detect JPEG
  const isJpeg =
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  if (!isPng && !isJpeg) {
    throw new Error(
      `❌ Remote file is NOT an image.\n` +
      `URL: ${url}\n` +
      `Bytes: ${buffer[0]},${buffer[1]},${buffer[2]},${buffer[3]}\n` +
      `Content-Type: ${response.headers.get("content-type")}`
    );
  }

  return Jimp.read(buffer);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      type,
      design_url,
      background_url,
      width_percent = 50,
      x_percent = 50,
      y_percent = 50,
      canvas_width,
      canvas_height,
      webhook_url,
      metadata
    } = req.body;

    if (!design_url || !background_url) {
      return res.status(400).json({ error: "Missing design_url or background_url" });
    }

    console.log("🎨 DESIGN:", design_url);
    console.log("🖼 BACKGROUND:", background_url);

    let final;

    if (type === "print") {
      const design = await loadImageSafe(design_url);
      const width = canvas_width || 4200;
      const height = canvas_height || 4800;

      const canvas = new Jimp(width, height, 0x00000000);

      const designAspect = design.bitmap.width / design.bitmap.height;
      const canvasAspect = width / height;

      let newW, newH;
      if (designAspect > canvasAspect) {
        newW = width;
        newH = Math.round(width / designAspect);
      } else {
        newH = height;
        newW = Math.round(height * designAspect);
      }

      design.resize(newW, newH);
      canvas.composite(design, (width - newW) / 2, (height - newH) / 2);
      final = canvas;
    } else {
      const background = await loadImageSafe(background_url);
      const design = await loadImageSafe(design_url);

      const targetWidth = Math.round((background.bitmap.width * width_percent) / 100);
      design.resize(targetWidth, Jimp.AUTO);

      const x = Math.round((background.bitmap.width * x_percent) / 100 - design.bitmap.width / 2);
      const y = Math.round((background.bitmap.height * y_percent) / 100 - design.bitmap.height / 2);

      background.composite(design, x, y);
      final = background;
    }

    const id = uuidv4();
    const outputPath = path.join("/tmp", `${id}.png`);

    await final.writeAsync(outputPath);

    const finalUrl = `https://${req.headers.host}/api/fetch-image?id=${id}`;

    if (webhook_url) {
      await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: finalUrl, metadata })
      });

      return res.status(200).json({ success: true, delivered: "webhook", image_url: finalUrl });
    }

    return res.status(200).json({ success: true, image_url: finalUrl });

  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
