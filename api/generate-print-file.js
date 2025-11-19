import Jimp from "jimp";
import fetch from "node-fetch";
import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      design_url,
      canvas_width,
      canvas_height,
      dpi = 300,
      max_design_width_percent = 90,
      max_design_height_percent = 90,
      placement_name = "print-file"
    } = req.body;

    // Validate required fields
    if (!design_url) {
      return res.status(400).json({ error: "Missing design_url" });
    }
    if (!canvas_width || !canvas_height) {
      return res.status(400).json({ error: "Missing canvas dimensions" });
    }

    console.log(`📄 Generating print file: ${canvas_width}x${canvas_height} @ ${dpi} DPI`);

    // Fetch design image
    const designRes = await fetch(design_url);
    if (!designRes.ok) {
      return res.status(400).json({ error: "Failed to fetch design image" });
    }

    const designBuf = Buffer.from(await designRes.arrayBuffer());
    const design = await Jimp.read(designBuf);

    // Create transparent canvas at exact dimensions
    const canvas = new Jimp(canvas_width, canvas_height, 0x00000000); // Transparent

    // Calculate max design dimensions (leave some safe margin)
    const maxDesignWidth = Math.round(canvas_width * (max_design_width_percent / 100));
    const maxDesignHeight = Math.round(canvas_height * (max_design_height_percent / 100));

    // Resize design to fit within max dimensions while maintaining aspect ratio
    design.scaleToFit(maxDesignWidth, maxDesignHeight);

    // Center the design on the canvas
    const x = Math.round((canvas_width - design.bitmap.width) / 2);
    const y = Math.round((canvas_height - design.bitmap.height) / 2);

    // Composite design onto canvas
    canvas.composite(design, x, y);

    // Get image as buffer
    const imageBuffer = await canvas.getBufferAsync(Jimp.MIME_PNG);

    // Upload to Vercel Blob storage
    const filename = `print-${placement_name}-${Date.now()}.png`;
    const blob = await put(filename, imageBuffer, {
      access: 'public',
      contentType: 'image/png'
    });

    console.log(`✅ Print file generated: ${blob.url}`);

    return res.status(200).json({
      success: true,
      print_file_url: blob.url,
      specs: {
        canvas_width,
        canvas_height,
        dpi,
        design_width: design.bitmap.width,
        design_height: design.bitmap.height
      }
    });

  } catch (err) {
    console.error("PRINT FILE ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
