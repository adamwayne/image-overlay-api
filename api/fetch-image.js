import fetch from "node-fetch";

/**
 * Fetch an image buffer from Dropbox (or any URL) without breaking query params.
 */
export async function loadImageBuffer(url) {
  if (!url) throw new Error("Missing URL");

  const clean = convertDropboxHost(url);

  const res = await fetch(clean, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("text/html")) {
    throw new Error("Dropbox returned HTML instead of an image. URL: " + clean);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Only replaces www.dropbox.com → dl.dropboxusercontent.com
 * Leaves ALL query parameters untouched.
 */
function convertDropboxHost(url) {
  return url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
}
