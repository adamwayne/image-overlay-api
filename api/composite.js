import sharp from "sharp";
import { loadImageBuffer } from "./fetch-image.js";

export default async function handler(req, res) {
    try {
        const { design_url, background_url } = req.body || {};

        if (!design_url || !background_url) {
            return res.status(400).json({ error: "Missing URLs" });
        }

        // Load both images as buffers
        const bgBuffer = await loadImageBuffer(background_url);
        const designBuffer = await loadImageBuffer(design_url);

        // Get background dimensions safely
        const bgMeta = await sharp(bgBuffer).metadata();

        if (!bgMeta.width || !bgMeta.height) {
            return res.status(400).json({
                error: "Background image has no valid dimensions"
            });
        }

        const BG_WIDTH = bgMeta.width;
        const BG_HEIGHT = bgMeta.height;

        // Resize design proportionally to a known max width
        const DESIGN_MAX_WIDTH = Math.floor(BG_WIDTH * 0.6);

        const resizedDesign = await sharp(designBuffer)
            .resize({
                width: DESIGN_MAX_WIDTH,
                withoutEnlargement: true
            })
            .toBuffer();

        // Composite design on top of background
        const output = await sharp(bgBuffer)
            .composite([
                {
                    input: resizedDesign,
                    gravity: "center"
                }
            ])
            .png()
            .toBuffer();

        // Return base64 safely
        const b64 = `data:image/png;base64,${output.toString("base64")}`;

        return res.status(200).json({
            success: true,
            image_url: b64
        });

    } catch (err) {
        console.error("❌ Composite error:", err);
        return res.status(500).json({ error: err.message });
    }
}
