'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

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
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" aria-hidden />

      <motion.div
        className="flex w-max gap-5"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
      >
        {TRACK.map((logo, i) => (
          <div
            key={i}
            className="flex h-24 w-44 shrink-0 items-center justify-center rounded-2xl border bg-card px-6 shadow-sm transition-shadow hover:shadow-md"
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
      </motion.div>
    </div>
  );
}
