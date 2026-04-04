/** Shown when a poster has no stored image (new default) or legacy URL is missing. */
export const POSTER_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#e8eaed" width="400" height="500"/><text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#5f6368" font-family="system-ui,sans-serif" font-size="15">No image stored</text></svg>'
  );

export function posterImgSrc(poster) {
  const url = poster?.image_url;
  if (url && typeof url === 'string' && url.trim()) return url;
  return POSTER_IMAGE_PLACEHOLDER;
}
