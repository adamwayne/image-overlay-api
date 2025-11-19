import Jimp from "jimp";
import fetch from "node-fetch";
import { put } from "@vercel/blob";

/**
 * Generates both mockup and print file for a single placement
 */
async function generatePlacement(designImage, placement, productId) {
  const results = {};

  // Generate mockup if background URL is provided
  if (placement.background_url) {
    console.log(`  📸 Generating mockup: ${placement.placement}`);

    const bgRes = await fetch(placement.background_url);
    if (!bgRes.ok) {
      throw new Error(`Failed to fetch background for ${placement.placement}`);
    }

    const bgBuf = Buffer.from(await bgRes.arrayBuffer());
    const background = await Jimp.read(bgBuf);

    // Clone design for this mockup
    const design = designImage.clone();

    // Resize design based on percentage
    const width_percent = placement.width_percent || 50;
    const newWidth = Math.round((background.bitmap.width * width_percent) / 100);
    design.resize(newWidth, Jimp.AUTO);

    // Position design
    const x_percent = placement.x_percent || 50;
    const y_percent = placement.y_percent || 50;
    const px = Math.round(
      background.bitmap.width * (x_percent / 100) - design.bitmap.width / 2
    );
    const py = Math.round(
      background.bitmap.height * (y_percent / 100) - design.bitmap.height / 2
    );

    // Composite
    background.composite(design, px, py);

    // Upload mockup
    const mockupBuffer = await background.getBufferAsync(Jimp.MIME_PNG);
    const mockupFilename = `${productId}-mockup-${placement.placement.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
    const mockupBlob = await put(mockupFilename, mockupBuffer, {
      access: 'public',
      contentType: 'image/png'
    });

    results.mockup_url = mockupBlob.url;
    results.mockup_position = placement.position || null;
  }

  // Generate print file if print specs are provided
  if (placement.print) {
    console.log(`  📄 Generating print file: ${placement.placement}`);

    const { canvas_width, canvas_height } = placement.print;
    const max_percent = placement.print.max_design_percent || 90;

    // Create transparent canvas
    const canvas = new Jimp(canvas_width, canvas_height, 0x00000000);

    // Clone design for print file
    const design = designImage.clone();

    // Calculate max design dimensions
    const maxDesignWidth = Math.round(canvas_width * (max_percent / 100));
    const maxDesignHeight = Math.round(canvas_height * (max_percent / 100));

    // Resize to fit
    design.scaleToFit(maxDesignWidth, maxDesignHeight);

    // Center on canvas
    const x = Math.round((canvas_width - design.bitmap.width) / 2);
    const y = Math.round((canvas_height - design.bitmap.height) / 2);

    canvas.composite(design, x, y);

    // Upload print file
    const printBuffer = await canvas.getBufferAsync(Jimp.MIME_PNG);
    const printFilename = `${productId}-print-${placement.placement.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
    const printBlob = await put(printFilename, printBuffer, {
      access: 'public',
      contentType: 'image/png'
    });

    results.print_file_url = printBlob.url;
    results.print_file_position = placement.print.position || null;
    results.print_specs = {
      canvas_width,
      canvas_height,
      design_width: design.bitmap.width,
      design_height: design.bitmap.height
    };
  }

  return results;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      design_url,
      render_config,
      product_id = "product"
    } = req.body;

    // Validate inputs
    if (!design_url) {
      return res.status(400).json({ error: "Missing design_url" });
    }
    if (!render_config || !render_config.display || !Array.isArray(render_config.display)) {
      return res.status(400).json({ error: "Missing or invalid render_config.display" });
    }

    console.log(`🎨 Generating product: ${product_id}`);
    console.log(`📋 ${render_config.display.length} placements to process`);

    // Fetch design image once
    const designRes = await fetch(design_url);
    if (!designRes.ok) {
      return res.status(400).json({ error: "Failed to fetch design image" });
    }

    const designBuf = Buffer.from(await designRes.arrayBuffer());
    const designImage = await Jimp.read(designBuf);

    console.log(`✓ Design loaded: ${designImage.bitmap.width}x${designImage.bitmap.height}`);

    // Process all placements
    const results = [];

    for (const placement of render_config.display) {
      console.log(`\n🔧 Processing: ${placement.placement}`);

      try {
        const placementResult = await generatePlacement(designImage, placement, product_id);

        results.push({
          placement: placement.placement,
          ...placementResult
        });

        console.log(`  ✅ Complete`);
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
        results.push({
          placement: placement.placement,
          error: err.message
        });
      }
    }

    console.log(`\n✨ Product generation complete!`);

    return res.status(200).json({
      success: true,
      product_id,
      files: results
    });

  } catch (err) {
    console.error("PRODUCT GENERATION ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
