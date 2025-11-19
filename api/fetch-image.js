import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).send("Missing id");
  }

  const filePath = path.join("/tmp", `${id}.png`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Image not found");
  }

  const fileStream = fs.createReadStream(filePath);

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  fileStream.pipe(res);
}
