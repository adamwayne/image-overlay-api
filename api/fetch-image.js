import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).send("Missing id");
  }

  const file = path.join("/tmp", `${id}.png`);

  if (!fs.existsSync(file)) {
    return res.status(404).send("Image not found");
  }

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  const stream = fs.createReadStream(file);
  stream.pipe(res);
}
