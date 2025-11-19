import fetch from "node-fetch";

/**
 * Bulletproof Dropbox loader:
 *  - follows redirects manually
 *  - rejects HTML / JSON disguised as PNG
 *  - guarantees Buffer output only
 */
export async function fetchDropboxImage(url) {
  if (!url) throw new Error("Missing URL.");

  // 🔥 Dropbox sometimes returns HTML even from dl.dropboxusercontent.com
  function looksLikeHTML(buffer) {
    const text = buffer.toString("utf8").slice(0, 200).toLowerCase();
    return text.includes("<html") || text.includes("<!doctype");
  }

  function looksLikeJSON(buffer) {
    const txt = buffer.toString("utf8").trim();
    return txt.startsWith("{") && txt.endsWith("}");
  }

  let finalUrl = url.trim();

  // 🔥 Force Dropbox to deliver binary
  if (!finalUrl.includes("dl=1")) {
    finalUrl += (finalUrl.includes("?") ? "&" : "?") + "dl=1";
  }

  // 🔥 Follow redirects manually (Dropbox does 1–2 hops)
  for (let i = 0; i < 5; i++) {
    const res = await fetch(finalUrl, { redirect: "manual" });

    // Redirect?
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      finalUrl = res.headers.get("location");
      continue;
    }

    // No redirect → load body
    const buffer = Buffer.from(await res.arrayBuffer());

    if (looksLikeHTML(buffer)) {
      throw new Error("Dropbox returned HTML instead of image (bad URL or blocked).");
    }
    if (looksLikeJSON(buffer)) {
      throw new Error("Dropbox returned JSON instead of image (bad link or expired token).");
    }

    if (!buffer || buffer.length < 100) {
      throw new Error("Dropbox returned empty or invalid image buffer.");
    }

    return buffer;
  }

  throw new Error("Too many redirect hops. Dropbox URL may be invalid.");
}
