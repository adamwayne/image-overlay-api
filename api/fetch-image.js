import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).send("Missing id");

    const filePath = path.join("/tmp", `${id}.png`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found");
    }

    const img = fs.readFileSync(filePath);
    res.setHeader("Content-Type", "image/png");
    res.send(img);
  } catch (err) {
    console.error("Fetch-error:", err);
    res.status(500).send("Server error");
  }
}
