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
 * Where Proamina® is present. Italy is home and is drawn in the brand's sky
 * blue; every other market is yellow. No lines between them — the map states
 * presence, not routes.
 */
export const MARKERS = [
  { lat: 44.49, lng: 11.34, label: 'Italia — Bologna', home: true },
  { lat: 51.51, lng: -0.13, label: 'United Kingdom' },
  { lat: 47.38, lng: 8.54, label: 'Switzerland' },
  { lat: 59.33, lng: 18.07, label: 'Sweden' },
  { lat: 52.37, lng: 4.9, label: 'Netherlands' },
  { lat: 50.85, lng: 4.35, label: 'Belgium' },
  { lat: 40.42, lng: -3.7, label: 'Spain' },
  { lat: 52.52, lng: 13.4, label: 'Germany' },
  { lat: 25.2, lng: 55.27, label: 'United Arab Emirates' },
  { lat: 24.71, lng: 46.68, label: 'Saudi Arabia' },
  { lat: -33.87, lng: 151.21, label: 'Australia' },
  { lat: 40.71, lng: -74.01, label: 'United States' },
];
