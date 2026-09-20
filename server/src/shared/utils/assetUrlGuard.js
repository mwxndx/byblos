/**
 * SSRF guard for digital-product downloads.
 *
 * `digital_file_path` is seller-controlled and is meant to hold a Cloudinary
 * public_id, but legacy rows (and getDigitalAssetUrls' http(s) passthrough) can
 * yield a full URL. The download endpoint fetches that URL server-side and
 * follows redirects, so every URL it is about to fetch — the candidate and any
 * redirect Location — must be restricted to Cloudinary. Anything else (internal
 * hosts, cloud metadata, localhost) is refused.
 */
export function isCloudinaryAssetUrl(candidate) {
  try {
    const { protocol, hostname } = new URL(candidate);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return hostname === 'cloudinary.com' || hostname.endsWith('.cloudinary.com');
  } catch {
    // Not an absolute URL (relative path / garbage) — not a fetchable host.
    return false;
  }
}
