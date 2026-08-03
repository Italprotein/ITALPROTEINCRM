import Image from 'next/image';

/* Collaborators — logos only, no names (provided in assets/Images). */
const LOGOS = [
  { src: '/partners/venchi.webp', alt: 'Venchi' },
  { src: '/partners/protein-works.png', alt: 'The Protein Works' },
  { src: '/partners/molino-casillo.png', alt: 'Molino Casillo' },
  { src: '/partners/emmi.jpg', alt: 'Emmi' },
  { src: '/partners/nicks.avif', alt: "Nick's" },
  { src: '/partners/naturasi.png', alt: 'NaturaSì' },
  { src: '/partners/foodness.jpg', alt: 'Foodness' },
  { src: '/partners/funkie.png', alt: 'Funkie' },
  { src: '/partners/abs-food.jpg', alt: 'ABS Food' },
  { src: '/partners/toschi.png', alt: 'Toschi' },
  { src: '/partners/unione-plus.png', alt: 'Union Plus' },
  { src: '/partners/afr-group.jpg', alt: 'AFR Group' },
];

/* Two identical halves so the -50% loop is perfectly seamless. */
const TRACK = [...LOGOS, ...LOGOS];

export function PartnerMarquee() {
  return (
    <div className="relative overflow-hidden">
      {/* Edge fades. `brand-navy`, not the themed `background` token: this
          strip now runs inside the public column, whose field is navy in both
          themes, so a light-theme fade left two pale bars over the navy. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-brand-navy to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-brand-navy to-transparent" aria-hidden />

      {/* Tiles are an explicit light chip, not the themed `bg-card`: ten of the
          twelve partner logos are opaque files with a white background, so a
          navy tile would frame each one in a white rectangle and hide the two
          transparent ones entirely. Explicit white also does not flip with the
          app's dark mode, which the column's navy field never does either.

          CSS keyframes rather than a motion library: this is the only motion
          left on the page that repeats, and it costs nothing to hydrate. */}
      <div className="flex w-max gap-5 motion-safe:animate-marquee">
        {TRACK.map((logo, i) => (
          <div
            key={i}
            className="flex h-24 w-44 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/95 px-6 transition-colors hover:bg-white"
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              width={150}
              height={56}
              className="max-h-12 w-auto object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
