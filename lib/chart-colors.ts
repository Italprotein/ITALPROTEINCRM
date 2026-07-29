/**
 * On-brand categorical palette (navy · gold · teal · molecular + tints).
 *
 * Kept in its own module, deliberately free of any chart-library import: pages
 * that only need a colour — the companies and agencies lists use CHART_COLORS[0]
 * as an avatar fallback — should not risk pulling recharts into their bundle
 * just to read an array of strings. components/charts/chart-kit re-exports it,
 * so existing chart code is unaffected.
 */
export const CHART_COLORS: string[] = [
  '#0a1628', // brand navy
  '#c9a227', // brand gold
  '#0eb89a', // brand teal
  '#2563eb', // molecular blue
  '#1b3a5b', // navy600 tint
  '#e8c84a', // goldLight tint
  '#6f8a6b', // sage
  '#0a9980', // tealDark
];
