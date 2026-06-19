import type { Product } from '@/lib/types';

/**
 * Mock client products developed with Proamina. companyId references valid
 * companies; relatedProjectId links to fixtures/projects.ts where applicable.
 */
export const PRODUCTS: Product[] = [
  { id: 'prd_pw_1', name: 'PW Reduced-Sugar Protein Bar', category: 'protein_bars', companyId: 'c_proteinworks', brandName: 'The Protein Works', market: 'UK & Ireland', proaminaDosage: '4.5% w/w', status: 'in_development', description: 'Reduced-sugar protein bar at taste parity with full-sugar reference.', relatedProjectId: 'prj_pw_1', createdAt: '2026-04-05' },
  { id: 'prd_pw_2', name: 'PW Clear Protein Shake', category: 'beverages', companyId: 'c_proteinworks', brandName: 'The Protein Works', market: 'UK & Ireland', proaminaDosage: '0.8% w/v', status: 'in_development', description: 'Clear RTD protein shake, sugar-free.', relatedProjectId: 'prj_pw_2', createdAt: '2026-05-15' },
  { id: 'prd_venchi_1', name: 'Venchi Reduced-Sugar Praline', category: 'chocolate', companyId: 'c_venchi', brandName: 'Venchi', market: 'Italy / Export', proaminaDosage: '6% w/w', status: 'tested', description: 'Premium praline with reduced sugar.', relatedProjectId: 'prj_venchi_1', createdAt: '2026-04-15' },
  { id: 'prd_eurosup_1', name: 'Eurosup Pro Bar', category: 'protein_bars', companyId: 'c_eurosup', brandName: 'Eurosup', market: 'Italy / EU', proaminaDosage: '5% w/w', status: 'launched', description: 'Commercial reduced-sugar protein bar.', relatedProjectId: 'prj_eurosup_1', createdAt: '2026-01-10' },
  { id: 'prd_eurosup_2', name: 'Eurosup RTD Shaker', category: 'beverages', companyId: 'c_eurosup', brandName: 'Eurosup', market: 'Italy / EU', proaminaDosage: '1% w/v', status: 'tested', description: 'RTD protein shaker line extension.', relatedProjectId: 'prj_eurosup_1', createdAt: '2026-04-10' },
  { id: 'prd_emmi_1', name: 'Emmi Protein Coffee', category: 'coffee', companyId: 'c_emmi', brandName: 'Emmi', market: 'Switzerland / EU', proaminaDosage: '0.9% w/v', status: 'in_development', description: 'Reduced-sugar protein coffee RTD.', relatedProjectId: 'prj_emmi_1', createdAt: '2026-01-20' },
  { id: 'prd_icedog_1', name: 'Icedog Protein Gelato', category: 'ice_cream', companyId: 'c_icedog', brandName: 'Icedog', market: 'Italy', proaminaDosage: '8% w/w', status: 'in_development', description: 'Low-sugar high-protein gelato base.', relatedProjectId: 'prj_icedog_1', createdAt: '2026-02-01' },
  { id: 'prd_nicks_1', name: "Nick's Protein Ice Cream", category: 'ice_cream', companyId: 'c_nicks', brandName: "Nick's", market: 'Nordics / EU', proaminaDosage: '7% w/w', status: 'tested', description: 'Low-sugar protein ice cream.', relatedProjectId: 'prj_nicks_1', createdAt: '2026-03-05' },
  { id: 'prd_bel_1', name: 'Materne Protein Snack', category: 'dairy', companyId: 'c_bel', brandName: 'Materne by Bel', market: 'France / EU', proaminaDosage: '1.2% w/w', status: 'in_development', description: 'Fruit-dairy protein snack.', relatedProjectId: 'prj_bel_1', createdAt: '2026-04-20' },
  { id: 'prd_vegamore_1', name: 'Vegamore Protein Latte', category: 'plant_based', companyId: 'c_vegamore', brandName: 'Vegamore', market: 'Italy / HoReCa', proaminaDosage: '1% w/v', status: 'tested', description: 'Plant-based protein latte.', relatedProjectId: 'prj_vegamore_1', createdAt: '2026-05-10' },
  { id: 'prd_panettieri_1', name: 'Panettieri Protein Pastry Cream', category: 'desserts', companyId: 'c_panettieri', brandName: 'Silvio Panettieri', market: 'Italy / HoReCa', proaminaDosage: '5% w/w', status: 'tested', description: 'Reduced-sugar pastry cream for pastries.', createdAt: '2026-05-15' },
  { id: 'prd_casillo_1', name: 'NextGen Protein Flour', category: 'bakery', companyId: 'c_casillo', brandName: 'Casillo', market: 'Italy / B2B', proaminaDosage: '3% w/w', status: 'in_development', description: 'Protein-enriched flour blend.', relatedProjectId: 'prj_casillo_1', createdAt: '2026-03-01' },
  { id: 'prd_sudzucker_1', name: 'Joint Sugar-Reduction System', category: 'other', companyId: 'c_sudzucker', brandName: 'Südzucker', market: 'EU', proaminaDosage: 'Variable', status: 'in_development', description: 'Co-developed sugar-reduction ingredient system.', relatedProjectId: 'prj_sudzucker_1', createdAt: '2026-04-25' },
  { id: 'prd_disproquima_1', name: 'Proamina (Iberia distribution)', category: 'other', companyId: 'c_disproquima', brandName: 'Disproquima', market: 'Spain / Portugal', status: 'in_development', description: 'Distribution SKU for Iberian market.', relatedProjectId: 'prj_disproquima_1', createdAt: '2026-02-20' },
];

export function getProducts(): Product[] {
  return PRODUCTS;
}
