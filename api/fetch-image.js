import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).send("Missing id");

  const filePath = path.join("/tmp", `${id}.png`);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Not found");
    }

    const file = fs.readFileSync(filePath);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", file.length);

    return res.status(200).send(file);

  } catch (error) {
    console.error("❌ fetch-image error:", error);
    return res.status(500).send("Server error");
  }
}
