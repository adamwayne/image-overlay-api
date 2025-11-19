import fetch from "node-fetch";

export default async function fetchImage(url) {
  if (!url) throw new Error("Missing URL");

  const clean = sanitize(url);
  const res = await fetch(clean);

  const type = res.headers.get("content-type");
  if (type && type.includes("text/html")) {
    throw new Error("Dropbox returned HTML instead of image: " + clean);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function sanitize(url) {
  let u = url.replace("www.dropbox.com", "dl.dropboxusercontent.com");

  // Remove any ?dl=0, ?dl=1, &dl=1, etc
  u = u.replace(/(\?dl=\d)/, "");
  u = u.replace(/(\?raw=\d)/, "");
  u = u.replace(/(&raw=\d)/, "");

  // Ensure raw=1
  return u + (u.includes("?") ? "&raw=1" : "?raw=1");
}
