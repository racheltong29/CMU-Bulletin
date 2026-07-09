/**
 * Feature hero settings (developer configuration).
 *
 * FEATURE_HERO_ENABLED — set to false to hide the banner entirely.
 *   Env override: VITE_FEATURE_HERO_ENABLED=false
 *
 * FEATURE_HERO_IMAGE — optional custom banner image path.
 *   1. Add the image to `public/` (e.g. `public/feature-hero.jpg`)
 *   2. Set `FEATURE_HERO_IMAGE` below to that path (e.g. '/feature-hero.jpg')
 *   Env override: VITE_FEATURE_HERO_IMAGE=/feature-hero.jpg
 *
 * When enabled with no custom image, the default banner is shown
 * (headline, subtext, and illustrated cards).
 */
const FEATURE_HERO_ENABLED_FROM_CONFIG = true;
const FEATURE_HERO_IMAGE_FROM_CONFIG = '';

const parseFeatureHeroEnabled = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return value !== 'false' && value !== '0';
};

export const FEATURE_HERO_ENABLED = parseFeatureHeroEnabled(
  import.meta.env.VITE_FEATURE_HERO_ENABLED,
  FEATURE_HERO_ENABLED_FROM_CONFIG
);

export const FEATURE_HERO_IMAGE = (
  import.meta.env.VITE_FEATURE_HERO_IMAGE || FEATURE_HERO_IMAGE_FROM_CONFIG
).trim();

export const FEATURE_HERO_IMAGE_ALT = 'Featured highlight';
