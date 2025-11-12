const sharp = require('sharp');
const fetch = require('node-fetch');

// Print file dimensions in pixels at 300 DPI
const PRINT_DIMENSIONS = {
  "Front Full": { width: 4200, height: 4800 },
  "Front Pocket": { width: 4200, height: 3000 },
  "Back Full": { width: 4200, height: 4800 },
  "Left Chest": { width: 1500, height: 1500 },
  "Sleeve": { width: 1140, height: 1140 }
};

module.exports = async (req, res) => {
  try {
    const { background_url, design_url, webhook_url, metadata, type, placement } = req.body;
    
    let outputBuffer;
    
    // PRINT FILE - just resize design to print dimensions
    if (type === "print") {
      const dims = PRINT_DIMENSIONS[placement];
      if (!dims) {
        throw new Error(`Unknown placement: ${placement}`);
      }
      
      const designResp = await fetch(design_url);
      const designBuffer = await designResp.buffer();
      
      outputBuffer = await sharp(designBuffer)
        .resize(dims.width, dims.height, { fit: 'inside' })
        .png()
        .toBuffer();
    }
    // DISPLAY FILE - composite design onto blank
    else {
      const [backgroundResp, designResp] = await Promise.all([
        fetch(background_url),
        fetch(design_url)
      ]);
      
      const backgroundBuffer = await backgroundResp.buffer();
      const designBuffer = await designResp.buffer();
      
      const bgMetadata = await sharp(backgroundBuffer).metadata();
      
      // Default: center design at 50% of background width
      const designWidth = Math.round(bgMetadata.width * 0.5);
      
      const resizedDesign = await sharp(designBuffer)
        .resize(designWidth, null, { fit: 'inside' })
        .toBuffer();
      
      outputBuffer = await sharp(backgroundBuffer)
        .composite([{
          input: resizedDesign,
          gravity: 'center'
        }])
        .png()
        .toBuffer();
    }
    
    const base64Image = outputBuffer.toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;
    
    if (webhook_url) {
      await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          image_url: imageUrl,
          metadata: metadata
        })
      });
    }
    
    res.status(200).json({
      status: 'completed',
      image_url: imageUrl,
      metadata: metadata
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
