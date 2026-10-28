/**
 * SSRF guard for digital-product downloads.
 *
 * `digital_file_path` is seller-controlled and must hold a Cloudinary public_id.
 * Write-path sanitization rejects absolute URLs, and getDigitalAssetUrls fails
 * closed (returns no candidates) if one is still present. The download endpoint
 * still fetches candidate URLs server-side and may follow redirects, so every
 * URL about to be fetched — the candidate and any redirect Location — is
 * restricted to Cloudinary. Anything else (internal hosts, cloud metadata,
 * localhost) is refused.
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
