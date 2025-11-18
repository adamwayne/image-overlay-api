import sharp from "sharp";

export const config = {
  api: {
    bodyParser: false, // disable Vercel's auto-parser
  },
};

export default async function handler(req, res) {
  try {
    // --- Parse raw body manually (fixes req.body undefined) ---
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString();
    const body = JSON.parse(rawBody || "{}");

    const {
      type,
      design_url,
      background_url,
      width_percent,
      x_percent,
      y_percent,
      canvas_width,
      canvas_height,
      safe_width,
      safe_height,
      full_bleed,
      placements,
      webhook_url,
      metadata,
    } = body;

    // --- Fetch design image ---
    const designResp = await fetch(design_url);
    const designBuffer = Buffer.from(await designResp.arrayBuffer());

    let outputBuffer;

    // --- PRINT MODE ---
    if (type === "print") {
      if (placements && placements.length > 0) {
        // Multi-placement (e.g., mug wrap)
        const canvas = sharp({
          create: {
            width: canvas_width,
            height: canvas_height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        });

        const composites = [];
        for (const placement of placements) {
          const resized = await sharp(designBuffer)
            .resize(placement.max_width, placement.max_height, { fit: "inside" })
            .toBuffer();

          const meta = await sharp(resized).metadata();
          const left = Math.round(
            canvas_width * (placement.x_percent / 100) - meta.width / 2
          );
          const top = Math.round(
            canvas_height * (placement.y_percent / 100) - meta.height / 2
          );

          composites.push({ input: resized, left, top });
        }

        outputBuffer = await canvas.composite(composites).png().toBuffer();
      } else {
        // Single placement
        let maxWidth, maxHeight;

        if (full_bleed) {
          maxWidth = canvas_width;
          maxHeight = canvas_height;
        } else {
          maxWidth = safe_width || Math.floor(canvas_width * 0.9);
          maxHeight = safe_height || Math.floor(canvas_height * 0.9);
        }

        const resizedDesign = await sharp(designBuffer)
          .resize(maxWidth, maxHeight, { fit: full_bleed ? "cover" : "inside" })
          .toBuffer();

        const resizedMeta = await sharp(resizedDesign).metadata();
        const left = Math.floor((canvas_width - resizedMeta.width) / 2);
        const top = Math.floor((canvas_height - resizedMeta.height) / 2);

        outputBuffer = await sharp({
          create: {
            width: canvas_width,
            height: canvas_height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .composite([{ input: resizedDesign, left, top }])
          .png()
          .toBuffer();
      }

      // --- DISPLAY MODE ---
    } else {
      const backgroundResp = await fetch(background_url);
      const backgroundBuffer = Buffer.from(await backgroundResp.arrayBuffer());
      const bgMetadata = await sharp(backgroundBuffer).metadata();

      const designWidth = Math.round(bgMetadata.width * (width_percent / 100));

      const resizedDesign = await sharp(designBuffer)
        .resize(designWidth, null, { fit: "inside" })
        .toBuffer();

      const resizedMeta = await sharp(resizedDesign).metadata();
      const left = Math.round(
        bgMetadata.width * (x_percent / 100) - resizedMeta.width / 2
      );
      const top = Math.round(bgMetadata.height * (y_percent / 100));

      outputBuffer = await sharp(backgroundBuffer)
        .composite([{ input: resizedDesign, left, top }])
        .png()
        .toBuffer();
    }

    // --- Convert to base64 image URL ---
    const base64Image = `data:image/png;base64,${outputBuffer.toString(
      "base64"
    )}`;

    // --- Optional webhook callback ---
    if (webhook_url) {
      await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: base64Image,
          metadata: metadata,
        }),
      });
    }

    res.status(200).json({ success: true, image_url: base64Image });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
