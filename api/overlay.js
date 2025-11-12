import sharp from "sharp";

// tiny helper: fetch through a proxy that allows image hotlinking
async function fetchImage(url) {
  const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}`;
  const resp = await fetch(proxy, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*,*/*" }
  });
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status} for ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

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

    if (!baseUrl) return res.status(400).json({ error: "Base image URL required" });

    // always fetch through proxy so iconsdb works
    const baseBuf = await fetchImage(baseUrl);

    const composites = await Promise.all(
      overlays.map(async (layer) => {
        const overlayBuf = await fetchImage(layer.url);
        let overlay = sharp(overlayBuf).png();
        if (layer.width || layer.height) {
          overlay = overlay.resize(
            layer.width ? parseInt(layer.width) : null,
            layer.height ? parseInt(layer.height) : null
          );
        }
        return {
          input: await overlay.toBuffer(),
          top: layer.y || 0,
          left: layer.x || 0,
          opacity: layer.opacity ?? 1
        };
      })
    );

    let image = sharp(baseBuf);
    if (composites.length) image = image.composite(composites);

    const outBuf = await image.toFormat(format).toBuffer();
    res.setHeader("Content-Type", `image/${format}`);
    res.send(outBuf);
  } catch (err) {
    console.error("❌ Overlay error:", err);
    res.status(500).json({ error: err.message });
  }
}
