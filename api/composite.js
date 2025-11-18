const sharp = require('sharp');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
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
      metadata
    } = req.body;

    const designResp = await fetch(design_url);
    const designBuffer = await designResp.buffer();

    let outputBuffer;

    if (type === 'print') {
      if (placements && placements.length > 0) {
        // Multi-placement (e.g., mug wrap)
        const canvas = sharp({
          create: {
            width: canvas_width,
            height: canvas_height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        });

        const composites = [];
        for (const placement of placements) {
          const resized = await sharp(designBuffer)
            .resize(placement.max_width, placement.max_height, { fit: 'inside' })
            .toBuffer();
          
          const meta = await sharp(resized).metadata();
          const left = Math.round((canvas_width * (placement.x_percent / 100)) - (meta.width / 2));
          const top = Math.round((canvas_height * (placement.y_percent / 100)) - (meta.height / 2));
          
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
          .resize(maxWidth, maxHeight, { fit: full_bleed ? 'cover' : 'inside' })
          .toBuffer();

        const resizedMeta = await sharp(resizedDesign).metadata();
        const left = Math.floor((canvas_width - resizedMeta.width) / 2);
        const top = Math.floor((canvas_height - resizedMeta.height) / 2);

        outputBuffer = await sharp({
          create: {
            width: canvas_width,
            height: canvas_height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        })
          .composite([{ input: resizedDesign, left, top }])
          .png()
          .toBuffer();
      }

    } else {
      // Display render
      const backgroundResp = await fetch(background_url);
      const backgroundBuffer = await backgroundResp.buffer();
      const bgMetadata = await sharp(backgroundBuffer).metadata();

      const designWidth = Math.round(bgMetadata.width * (width_percent / 100));

      const resizedDesign = await sharp(designBuffer)
        .resize(designWidth, null, { fit: 'inside' })
        .toBuffer();

      const resizedMeta = await sharp(resizedDesign).metadata();
      const left = Math.round((bgMetadata.width * (x_percent / 100)) - (resizedMeta.width / 2));
      const top = Math.round(bgMetadata.height * (y_percent / 100));

      outputBuffer = await sharp(backgroundBuffer)
        .composite([{ input: resizedDesign, left, top }])
        .png()
        .toBuffer();
    }

    const base64Image = `data:image/png;base64,${outputBuffer.toString('base64')}`;

    if (webhook_url) {
      await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: base64Image,
          metadata: metadata
        })
      });
    }

    res.status(200).json({ success: true, image_url: base64Image });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
