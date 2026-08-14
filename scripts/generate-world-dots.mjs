#!/usr/bin/env node
/**
 * Generates the static dot-field SVG behind the landing page world map.
 *
 * `components/ui/world-map.tsx` used to build this SVG with `dotted-map` at
 * request time, TWICE (once per theme), and inline each copy as a
 * `data:image/svg+xml` data URI — two ~964 KB URIs baked into every page
 * load. The dot geometry is a fixed equirectangular projection, not
 * data-driven, so it never changes between requests; this script builds it
 * once, and the SVG is committed as a static asset. `world-map.tsx` now
 * masks a plain CSS background-color div with that asset instead of
 * inlining color-baked SVGs, so the theme switch (light/dark) is a CSS
 * class instead of a second multi-hundred-KB payload.
 *
 * This uses the SAME `DottedMap` constructor and `getSVG` options
 * `world-map.tsx`'s old `makeMap()` used, with one deliberate difference:
 * `color` is fixed to `#000` instead of being a parameter. The colour
 * painted on screen no longer comes from inside the SVG — the SVG is a CSS
 * mask now, not an `<img>` source — it comes from the `bg-*`/`dark:bg-*`
 * classes on the element being masked (see `world-map.tsx`). Only the dot
 * shape (opaque circle vs. transparent background) matters to a mask, so
 * any fully-opaque solid color masks identically; `#000` is arbitrary.
 *
 * Output (`public/marketing/world-dots.svg`) is COMMITTED. Re-run this
 * script only if the map geometry itself changes (grid, height, projection,
 * dot radius/shape) — the committed file, not this script, is the source of
 * truth the app reads from. Generation is byte-deterministic: `dotted-map`'s
 * dot placement is a pure function of these inputs with no randomness or
 * timestamps, so running this script twice in a row must produce
 * byte-identical output (part of Task 1's verification: run twice, `git
 * diff --stat` the SVG, expect no diff).
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import DottedMap from 'dotted-map';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '../public/marketing/world-dots.svg');

const map = new DottedMap({
  height: 100,
  grid: 'diagonal',
  projection: { name: 'equirectangular' },
});

const svg = map.getSVG({
  radius: 0.22,
  color: '#000',
  shape: 'circle',
  backgroundColor: 'transparent',
});

writeFileSync(OUTPUT_PATH, svg);

console.log(`Wrote ${svg.length} bytes to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
