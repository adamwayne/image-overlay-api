import sharp from "sharp";
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const body = req.method === "POST" ? req.body : req.query;
    const baseUrl = body.base;
    const overlays = body.overlays || [];
    const format = body.output || "png";

    if (!baseUrl) {
      return res.status(400).json({ error: "Base image URL required" });
    }

    // Fetch base image
    const baseResp = await fetch(baseUrl);
    const baseBuf = await baseResp.arrayBuffer();

    // Prepare overlay images
    const composites = await Promise.all(
      overlays.map(async (layer) => {
        const resp = await fetch(layer.url);
        const buf = await resp.arrayBuffer();
        return {
          input: Buffer.from(buf),
          top: layer.y || 0,
          left: layer.x || 0,
          opacity: layer.opacity ?? 1,
        };
      })
    );

    // Composite
    let result = sharp(Buffer.from(baseBuf));
    if (composites.length) result = result.composite(composites);

    // Output
    const outBuf = await result.toFormat(format).toBuffer();
    res.setHeader("Content-Type", `image/${format}`);
    res.send(outBuf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
