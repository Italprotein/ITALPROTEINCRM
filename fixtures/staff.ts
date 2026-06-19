import type { InternalRole } from '@/lib/types';

/**
 * Internal staff directory. One entry per internal demo user in fixtures/users.ts
 * (names/emails/roles match), plus a few extra staff (legal counsel, second BD,
 * logistics assistant). assignedCompanyIds reflect accountOwnerId usage in
 * fixtures/companies.ts — giuseppe & ludwig own the most.
 */
export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: InternalRole;
  jobTitle: string;
  avatarColor?: string;
  status: 'active' | 'invited' | 'suspended';
  lastActiveAt: string;
  phone?: string;
  assignedCompanyIds: string[];
}

export const STAFF: StaffMember[] = [
  {
    id: 'u_admin', firstName: 'Alessandra', lastName: 'De Santis', email: 'ad@italprotein.com',
    role: 'super_admin', jobTitle: 'Super Administrator', avatarColor: '#0a1628',
    status: 'active', lastActiveAt: '2026-06-17T07:40:00Z', phone: '+39 02 1234 5600',
    assignedCompanyIds: [],
  },
  {
    id: 'u_medamine', firstName: 'Medamine', lastName: 'Labidi', email: 'labidimedamine53@gmail.com',
    role: 'crm_admin', jobTitle: 'CRM Administrator', avatarColor: '#1e3a5f',
    status: 'active', lastActiveAt: '2026-06-17T08:05:00Z', phone: '+39 02 1234 5601',
    assignedCompanyIds: [],
  },
  {
    id: 'u_simone', firstName: 'Simone', lastName: 'Coletta', email: 'simocolett@gmail.com',
    role: 'crm_admin', jobTitle: 'CRM Administrator', avatarColor: '#112840',
    status: 'active', lastActiveAt: '2026-06-16T17:20:00Z', phone: '+39 02 1234 5602',
    assignedCompanyIds: [],
  },
  {
    id: 'u_giuseppe', firstName: 'Giuseppe', lastName: 'Minelli', email: 'giuseppeminelli@wefin.it',
    role: 'business_dev', jobTitle: 'Head of Business Development', avatarColor: '#c9a227',
    status: 'active', lastActiveAt: '2026-06-17T08:30:00Z', phone: '+39 02 1234 5603',
    assignedCompanyIds: [
      'c_venchi', 'c_barilla', 'c_galbusera', 'c_colussi', 'c_fabbri', 'c_absfood', 'c_foodness',
      'c_gimoka', 'c_eurosup', 'c_prontofoods', 'c_panettieri', 'c_vegamore', 'c_icedog',
    ],
  },
  {
    id: 'u_ludwig', firstName: 'Ludwig', lastName: 'van Becker', email: 'ludwigvanbecker.3@gmail.com',
    role: 'business_dev', jobTitle: 'Export Business Developer', avatarColor: '#a07c1a',
    status: 'active', lastActiveAt: '2026-06-17T08:15:00Z', phone: '+39 02 1234 5604',
    assignedCompanyIds: [
      'c_proteinworks', 'c_casillo', 'c_naturasi', 'c_sudzucker', 'c_ehrmann', 'c_layenberger',
      'c_emmi', 'c_nom', 'c_bel', 'c_nutrimuscle', 'c_funkyveggie', 'c_funkyfat', 'c_yoplait',
      'c_nicks', 'c_disproquima', 'c_prinova', 'c_suntory', 'c_alainfarms', 'c_almarai', 'c_milaf',
      'c_ascomgum', 'c_incredo', 'c_nourishyou', 'c_crave', 'c_innofoods',
    ],
  },
  {
    id: 'u_ahmed', firstName: 'Ahmed', lastName: 'Hassan', email: 'ahmedabuniv@gmail.com',
    role: 'rnd_technical', jobTitle: 'R&D Technical Lead', avatarColor: '#0eb89a',
    status: 'active', lastActiveAt: '2026-06-17T07:55:00Z', phone: '+39 02 1234 5605',
    assignedCompanyIds: ['c_proteinworks', 'c_venchi', 'c_barilla', 'c_sudzucker', 'c_emmi', 'c_bel'],
  },
  {
    id: 'u_marco', firstName: 'Marco', lastName: 'Riva', email: 'marco.riva@italprotein.com',
    role: 'logistics', jobTitle: 'Logistics Coordinator', avatarColor: '#2563eb',
    status: 'active', lastActiveAt: '2026-06-17T06:50:00Z', phone: '+39 02 1234 5606',
    assignedCompanyIds: [],
  },
  {
    id: 'u_elena', firstName: 'Elena', lastName: 'Brambilla', email: 'elena.brambilla@italprotein.com',
    role: 'finance', jobTitle: 'Finance Manager', avatarColor: '#6f8a6b',
    status: 'active', lastActiveAt: '2026-06-16T16:30:00Z', phone: '+39 02 1234 5607',
    assignedCompanyIds: [],
  },
  {
    id: 'u_davide', firstName: 'Davide', lastName: 'Ferri', email: 'davide.ferri@italprotein.com',
    role: 'management_readonly', jobTitle: 'Managing Director', avatarColor: '#566b53',
    status: 'active', lastActiveAt: '2026-06-15T18:00:00Z', phone: '+39 02 1234 5608',
    assignedCompanyIds: [],
  },

  /* ───────── Extra staff ───────── */
  {
    id: 'u_chiara', firstName: 'Chiara', lastName: 'Bonomi', email: 'chiara.bonomi@italprotein.com',
    role: 'business_dev', jobTitle: 'Legal Counsel', avatarColor: '#7a4ea0',
    status: 'active', lastActiveAt: '2026-06-16T15:10:00Z', phone: '+39 02 1234 5609',
    assignedCompanyIds: ['c_fabbri', 'c_barilla', 'c_prinova'],
  },
  {
    id: 'u_paolo', firstName: 'Paolo', lastName: 'Greco', email: 'paolo.greco@italprotein.com',
    role: 'business_dev', jobTitle: 'Business Developer (Italy South)', avatarColor: '#b5651d',
    status: 'invited', lastActiveAt: '2026-06-10T09:00:00Z', phone: '+39 02 1234 5610',
    assignedCompanyIds: ['c_panettieri', 'c_prontofoods'],
  },
  {
    id: 'u_lucia', firstName: 'Lucia', lastName: 'Fontana', email: 'lucia.fontana@italprotein.com',
    role: 'logistics', jobTitle: 'Logistics Assistant', avatarColor: '#3b82f6',
    status: 'active', lastActiveAt: '2026-06-17T06:45:00Z', phone: '+39 02 1234 5611',
    assignedCompanyIds: [],
  },
];

export function getStaff(): StaffMember[] {
  return STAFF;
}
