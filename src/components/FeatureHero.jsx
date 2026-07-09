import React from 'react';
import { FEATURE_HERO_ENABLED, FEATURE_HERO_IMAGE, FEATURE_HERO_IMAGE_ALT } from '../config/featureHero';

const categoryHeadlines = {
  All: 'Discover what\u2019s happening on campus',
  career: 'Find your next career opportunity',
  club: 'Explore clubs & organizations',
  performance: 'Catch live performances & shows',
  sport: 'Cheer on CMU athletics',
  social: 'Connect at social events',
  academic: 'Stay on top of academic events',
};

function FeatureHero({ activeCategory = 'All' }) {
  if (!FEATURE_HERO_ENABLED) {
    return null;
  }

  const hasCustomImage = Boolean(FEATURE_HERO_IMAGE);

  if (hasCustomImage) {
    return (
      <section className="feature-hero feature-hero--custom" aria-label={FEATURE_HERO_IMAGE_ALT}>
        <img
          src={FEATURE_HERO_IMAGE}
          alt={FEATURE_HERO_IMAGE_ALT}
          className="feature-hero__banner-image"
        />
      </section>
    );
  }

  const headline = categoryHeadlines[activeCategory] || categoryHeadlines.All;
  const label = activeCategory === 'All' ? 'CMU Bulletin' : activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);

  return (
    <section className="feature-hero" aria-label="Featured banner">
      <div className="feature-hero__bg">
        <div className="feature-hero__blob feature-hero__blob--1" />
        <div className="feature-hero__blob feature-hero__blob--2" />
        <div className="feature-hero__blob feature-hero__blob--3" />
      </div>

      <div className="feature-hero__content">
        <div className="feature-hero__text">
          <span className="feature-hero__eyebrow">{label}</span>
          <h2 className="feature-hero__headline">{headline}</h2>
          <p className="feature-hero__subtext">
            Browse events, clubs, and activities — all in one place.
          </p>
        </div>

        <div className="feature-hero__visual" aria-hidden="true">
          <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="24" y="48" width="88" height="120" rx="8" fill="#fff" stroke="#E8ECF0" strokeWidth="1.5" />
            <rect x="36" y="62" width="64" height="40" rx="4" fill="#36C3FF" opacity="0.85" />
            <rect x="36" y="110" width="48" height="6" rx="3" fill="#D6D6D6" />
            <rect x="36" y="124" width="56" height="6" rx="3" fill="#E8ECF0" />
            <rect x="36" y="138" width="40" height="6" rx="3" fill="#E8ECF0" />

            <rect x="108" y="28" width="88" height="120" rx="8" fill="#fff" stroke="#E8ECF0" strokeWidth="1.5" transform="rotate(4 152 88)" />
            <rect x="120" y="42" width="64" height="40" rx="4" fill="#FD5170" opacity="0.9" transform="rotate(4 152 62)" />
            <rect x="120" y="90" width="48" height="6" rx="3" fill="#D6D6D6" transform="rotate(4 144 93)" />
            <rect x="120" y="104" width="56" height="6" rx="3" fill="#E8ECF0" transform="rotate(4 148 107)" />

            <rect x="192" y="56" width="88" height="120" rx="8" fill="#fff" stroke="#E8ECF0" strokeWidth="1.5" transform="rotate(-3 236 116)" />
            <rect x="204" y="70" width="64" height="40" rx="4" fill="#864FF9" opacity="0.85" transform="rotate(-3 236 90)" />
            <rect x="204" y="118" width="48" height="6" rx="3" fill="#D6D6D6" transform="rotate(-3 228 121)" />
            <rect x="204" y="132" width="56" height="6" rx="3" fill="#E8ECF0" transform="rotate(-3 232 135)" />

            <circle cx="260" cy="52" r="18" fill="#c41230" opacity="0.12" />
            <circle cx="48" cy="180" r="24" fill="#36C3FF" opacity="0.1" />
          </svg>
        </div>
      </div>
    </section>
  );
}

export default FeatureHero;
