import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const filePath = path.join("/tmp", `${id}.png`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const image = fs.readFileSync(filePath);
    res.setHeader("Content-Type", "image/png");
    res.send(image);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
