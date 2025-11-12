const sharp = require('sharp');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    const { background_url, design_url, webhook_url, metadata } = req.body;

    // Download both images
    const [backgroundResp, designResp] = await Promise.all([
      fetch(background_url),
      fetch(design_url)
    ]);

    const backgroundBuffer = await backgroundResp.buffer();
    const designBuffer = await designResp.buffer();

    // Composite the images
    const outputBuffer = await sharp(backgroundBuffer)
      .composite([{
        input: designBuffer,
        gravity: 'center'
      }])
      .png()
      .toBuffer();

    // Convert to base64 for response
    const base64Image = outputBuffer.toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;

    // If webhook provided, call it
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

    // Return the image
    res.status(200).json({
      status: 'completed',
      image_url: imageUrl,
      metadata: metadata
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
