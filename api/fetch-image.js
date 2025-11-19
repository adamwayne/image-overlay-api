import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).send("Missing id");
  }

  const filePath = path.join("/tmp", `${id}.png`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Image not found");
  }

  try {
    const buffer = fs.readFileSync(filePath);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", buffer.length);

    return res.status(200).send(buffer);
  } catch (err) {
    console.error("❌ fetch-image error:", err);
    return res.status(500).send("Server error");
  }
}
