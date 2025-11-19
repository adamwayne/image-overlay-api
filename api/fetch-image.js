import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).send("Missing id");

    const filePath = path.join("/tmp", `${id}.png`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Not found");
    }

    const data = fs.readFileSync(filePath);
    res.setHeader("Content-Type", "image/png");
    res.send(data);

  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).send(err.message);
  }
}
