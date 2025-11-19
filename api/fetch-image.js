import fetch from "node-fetch";

export default async function fetchImage(url) {
  if (!url) throw new Error("Missing image URL");

  const cleanUrl = sanitizeDropbox(url);

  const response = await fetch(cleanUrl);

  const contentType = response.headers.get("content-type");

  // Detect HTML (Dropbox errors return HTML)
  if (contentType && contentType.includes("text/html")) {
    const html = await response.text();
    throw new Error("Dropbox returned HTML instead of image. URL: " + cleanUrl);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// Always enforce raw=1 and dl=1
function sanitizeDropbox(url) {
  return url
    .replace("www.dropbox.com", "dl.dropboxusercontent.com")
    .replace("?dl=0", "")
    .replace("?raw=1", "")
    .replace("&raw=1", "")
    + (url.includes("?") ? "&raw=1" : "?raw=1");
}
