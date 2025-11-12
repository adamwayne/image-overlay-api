import sharp from "sharp";
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const body =
      req.method === "POST"
        ? typeof req.body === "string"
          ? JSON.parse(req.body)
          : req.body
        : req.query;

    const baseUrl = body.base;
    const overlays = body.overlays || [];
    const format = body.output || "png";

    if (!baseUrl) {
      return res.status(400).json({ error: "Base image URL required" });
    }

    // Fetch base image
    const baseResp = await fetch(baseUrl);
    const baseBuf = Buffer.from(await baseResp.arrayBuffer());

    // Prepare overlays
    const composites = await Promise.all(
      overlays.map(async (layer) => {
        const resp = await fetch(layer.url);
        const buf = Buffer.from(await resp.arrayBuffer());

        // Convert to PNG and flatten color (fix invisible SVGs)
        let overlay = sharp(buf)
          .flatten({ background: { r: 255, g: 255, b: 255, alpha: 1 } }) // force opaque background
          .png();

        if (layer.width || layer.height) {
          overlay = overlay.resize(
            layer.width ? parseInt(layer.width) : null,
            layer.height ? parseInt(layer.height) : null
          );
        }

        const overlayBuf = await overlay.toBuffer();

        return {
          input: overlayBuf,
          top: layer.y || 0,
          left: layer.x || 0,
          opacity: layer.opacity ?? 1,
        };
      })
    );

    // Composite overlays
    let image = sharp(baseBuf);
    if (composites.length) image = image.composite(composites);

    const outBuf = await image.toFormat(format).toBuffer();
    res.setHeader("Content-Type", `image/${format}`);
    res.send(outBuf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
