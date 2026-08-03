/**
 * The only assets carried over from the previous site: the partner logos.
 * Country codes are shown under each mark, so the strip states who buys
 * Proamina® and from where rather than being a decorative logo wall.
 */
export const PARTNERS = [
  { logo: '/partners/venchi.webp', name: 'Venchi', title: 'IT' },
  { logo: '/partners/protein-works.png', name: 'The Protein Works', title: 'UK' },
  { logo: '/partners/molino-casillo.png', name: 'Molino Casillo', title: 'IT' },
  { logo: '/partners/emmi.jpg', name: 'Emmi', title: 'CH' },
  { logo: '/partners/nicks.avif', name: "Nick's", title: 'SE' },
  { logo: '/partners/naturasi.png', name: 'NaturaSì', title: 'IT' },
  { logo: '/partners/foodness.jpg', name: 'Foodness', title: 'IT' },
  { logo: '/partners/funkie.png', name: 'Funkie', title: 'NL' },
  { logo: '/partners/abs-food.jpg', name: 'ABS Food', title: 'IT' },
  { logo: '/partners/toschi.png', name: 'Toschi', title: 'IT' },
  { logo: '/partners/unione-plus.png', name: 'Union Plus', title: 'IT' },
  { logo: '/partners/afr-group.jpg', name: 'AFR Group', title: 'AE' },
].map((p) => ({ ...p, quote: `${p.name} — ${p.title}` }));

/**
 * Shipping lanes out of Bologna. Every arc ends somewhere Proamina® actually
 * goes, which is what makes the map worth showing: it is a statement of reach,
 * not an ornament.
 */
const BOLOGNA = { lat: 44.49, lng: 11.34, label: 'Bologna' };

export const LANES = [
  { start: BOLOGNA, end: { lat: 51.51, lng: -0.13, label: 'United Kingdom' } },
  { start: BOLOGNA, end: { lat: 47.38, lng: 8.54, label: 'Switzerland' } },
  { start: BOLOGNA, end: { lat: 59.33, lng: 18.07, label: 'Sweden' } },
  { start: BOLOGNA, end: { lat: 52.37, lng: 4.9, label: 'Netherlands' } },
  { start: BOLOGNA, end: { lat: 50.85, lng: 4.35, label: 'Belgium' } },
  { start: BOLOGNA, end: { lat: 40.42, lng: -3.7, label: 'Spain' } },
  { start: BOLOGNA, end: { lat: 52.52, lng: 13.4, label: 'Germany' } },
  { start: BOLOGNA, end: { lat: 25.2, lng: 55.27, label: 'United Arab Emirates' } },
  { start: BOLOGNA, end: { lat: 24.71, lng: 46.68, label: 'Saudi Arabia' } },
  { start: BOLOGNA, end: { lat: -33.87, lng: 151.21, label: 'Australia' } },
  { start: BOLOGNA, end: { lat: 40.71, lng: -74.01, label: 'United States' } },
];
