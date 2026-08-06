/**
 * Existing Italprotein / Proamina partner marks. The carousel duplicates this
 * collection at render time, so this source list intentionally stays unique.
 */
export const PARTNERS = [
  { logo: '/partners/venchi.webp', name: 'Venchi' },
  { logo: '/partners/protein-works.png', name: 'The Protein Works' },
  { logo: '/partners/molino-casillo.png', name: 'Molino Casillo' },
  { logo: '/partners/emmi.jpg', name: 'Emmi' },
  { logo: '/partners/nicks.avif', name: "Nick's" },
  { logo: '/partners/naturasi.png', name: 'NaturaSì' },
  { logo: '/partners/foodness.jpg', name: 'Foodness' },
  { logo: '/partners/funkie.png', name: 'Funkie' },
  { logo: '/partners/abs-food.jpg', name: 'ABS Food' },
  { logo: '/partners/toschi.png', name: 'Toschi' },
  { logo: '/partners/unione-plus.png', name: 'Union Plus' },
  { logo: '/partners/afr-group.jpg', name: 'AFR Group' },
].map((partner) => ({ ...partner, quote: partner.name }));

/**
 * Approximate company/contact locations reached by Italprotein. Every point is
 * geographically distinct so country totals remain honest while the map still
 * reads as a growing international network rather than a set of stacked pins.
 */
export const MARKERS = [
  // Italy — 15
  { lat: 45.46, lng: 9.19, label: 'Italy' }, // Milan
  { lat: 45.07, lng: 7.69, label: 'Italy' }, // Turin
  { lat: 44.41, lng: 8.93, label: 'Italy' }, // Genoa
  { lat: 45.44, lng: 10.99, label: 'Italy' }, // Verona
  { lat: 45.44, lng: 12.33, label: 'Italy' }, // Venice
  { lat: 44.49, lng: 11.34, label: 'Italy' }, // Bologna
  { lat: 44.8, lng: 10.33, label: 'Italy' }, // Parma
  { lat: 43.77, lng: 11.25, label: 'Italy' }, // Florence
  { lat: 43.62, lng: 13.52, label: 'Italy' }, // Ancona
  { lat: 41.9, lng: 12.5, label: 'Italy' }, // Rome
  { lat: 40.85, lng: 14.27, label: 'Italy' }, // Naples
  { lat: 41.12, lng: 16.87, label: 'Italy' }, // Bari
  { lat: 39.22, lng: 9.12, label: 'Italy' }, // Cagliari
  { lat: 38.12, lng: 13.36, label: 'Italy' }, // Palermo
  { lat: 37.51, lng: 15.08, label: 'Italy' }, // Catania

  // Germany — 4
  { lat: 52.52, lng: 13.41, label: 'Germany' }, // Berlin
  { lat: 53.55, lng: 10, label: 'Germany' }, // Hamburg
  { lat: 50.11, lng: 8.68, label: 'Germany' }, // Frankfurt
  { lat: 48.14, lng: 11.58, label: 'Germany' }, // Munich

  { lat: 47.38, lng: 8.54, label: 'Switzerland' }, // Zurich

  // United Kingdom — 4
  { lat: 51.51, lng: -0.13, label: 'United Kingdom' }, // London
  { lat: 52.49, lng: -1.89, label: 'United Kingdom' }, // Birmingham
  { lat: 53.48, lng: -2.24, label: 'United Kingdom' }, // Manchester
  { lat: 55.95, lng: -3.19, label: 'United Kingdom' }, // Edinburgh

  { lat: 48.86, lng: 2.35, label: 'France' }, // Paris

  // Spain — 2
  { lat: 40.42, lng: -3.7, label: 'Spain' }, // Madrid
  { lat: 41.39, lng: 2.17, label: 'Spain' }, // Barcelona

  { lat: 52.37, lng: 4.9, label: 'Netherlands' }, // Amsterdam
  { lat: 50.85, lng: 4.35, label: 'Belgium' }, // Brussels
  { lat: 48.21, lng: 16.37, label: 'Austria' }, // Vienna
  { lat: 55.68, lng: 12.57, label: 'Denmark' }, // Copenhagen
  { lat: 60.17, lng: 24.94, label: 'Finland' }, // Helsinki
  { lat: 59.33, lng: 18.07, label: 'Sweden' }, // Stockholm
  { lat: 41.33, lng: 19.82, label: 'Albania' }, // Tirana

  // Saudi Arabia — 6
  { lat: 24.71, lng: 46.68, label: 'Saudi Arabia' }, // Riyadh
  { lat: 21.49, lng: 39.19, label: 'Saudi Arabia' }, // Jeddah
  { lat: 26.43, lng: 50.1, label: 'Saudi Arabia' }, // Dammam
  { lat: 24.47, lng: 39.61, label: 'Saudi Arabia' }, // Medina
  { lat: 21.39, lng: 39.86, label: 'Saudi Arabia' }, // Mecca
  { lat: 28.38, lng: 36.57, label: 'Saudi Arabia' }, // Tabuk

  // United Arab Emirates — 8
  { lat: 25.2, lng: 55.27, label: 'United Arab Emirates' }, // Dubai
  { lat: 24.45, lng: 54.38, label: 'United Arab Emirates' }, // Abu Dhabi
  { lat: 25.35, lng: 55.42, label: 'United Arab Emirates' }, // Sharjah
  { lat: 25.41, lng: 55.51, label: 'United Arab Emirates' }, // Ajman
  { lat: 25.79, lng: 55.94, label: 'United Arab Emirates' }, // Ras Al Khaimah
  { lat: 25.13, lng: 56.33, label: 'United Arab Emirates' }, // Fujairah
  { lat: 24.21, lng: 55.74, label: 'United Arab Emirates' }, // Al Ain
  { lat: 25.56, lng: 55.55, label: 'United Arab Emirates' }, // Umm Al Quwain

  // India — 6
  { lat: 28.61, lng: 77.21, label: 'India' }, // Delhi
  { lat: 19.08, lng: 72.88, label: 'India' }, // Mumbai
  { lat: 12.97, lng: 77.59, label: 'India' }, // Bengaluru
  { lat: 17.39, lng: 78.49, label: 'India' }, // Hyderabad
  { lat: 13.08, lng: 80.27, label: 'India' }, // Chennai
  { lat: 22.57, lng: 88.36, label: 'India' }, // Kolkata

  { lat: -33.87, lng: 151.21, label: 'Australia' }, // Sydney
  { lat: -36.85, lng: 174.76, label: 'New Zealand' }, // Auckland
  { lat: 40.71, lng: -74.01, label: 'United States' }, // New York
  { lat: 43.65, lng: -79.38, label: 'Canada' }, // Toronto
  { lat: 41.01, lng: 28.98, label: 'Turkey' }, // Istanbul
] as const;
