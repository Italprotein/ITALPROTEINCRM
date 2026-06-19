import type { DemoAccount } from '@/lib/types';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  /* ── Internal staff ── */
  {
    id: 'u_admin', workspace: 'internal', role: 'super_admin',
    firstName: 'Alessandra', lastName: 'De Santis', email: 'ad@italprotein.com',
    jobTitle: 'Super Administrator', avatarColor: '#0a1628',
    blurb: 'Full system access — users, settings, audit log and every module.',
  },
  {
    id: 'u_medamine', workspace: 'internal', role: 'crm_admin',
    firstName: 'Medamine', lastName: 'Labidi', email: 'labidimedamine53@gmail.com',
    jobTitle: 'CRM Administrator', avatarColor: '#1e3a5f',
    blurb: 'Manages CRM data, user registrations and data quality.',
  },
  {
    id: 'u_simone', workspace: 'internal', role: 'crm_admin',
    firstName: 'Simone', lastName: 'Coletta', email: 'simocolett@gmail.com',
    jobTitle: 'CRM Administrator', avatarColor: '#112840',
    blurb: 'Manages CRM data, registrations and data quality across the pipeline.',
  },
  {
    id: 'u_giuseppe', workspace: 'internal', role: 'business_dev',
    firstName: 'Giuseppe', lastName: 'Minelli', email: 'giuseppeminelli@wefin.it',
    jobTitle: 'Head of Business Development', avatarColor: '#c9a227',
    blurb: 'Owns companies, contacts, pipeline and NDAs — the commercial engine.',
  },
  {
    id: 'u_ludwig', workspace: 'internal', role: 'business_dev',
    firstName: 'Ludwig', lastName: 'van Becker', email: 'ludwigvanbecker.3@gmail.com',
    jobTitle: 'Export Business Developer', avatarColor: '#a07c1a',
    blurb: 'Runs the international/export accounts and partner distribution deals.',
  },
  {
    id: 'u_ahmed', workspace: 'internal', role: 'rnd_technical',
    firstName: 'Ahmed', lastName: 'Hassan', email: 'ahmedabuniv@gmail.com',
    jobTitle: 'R&D Technical Lead', avatarColor: '#0eb89a',
    blurb: 'Reviews feedback, drives application projects and technical replies.',
  },
  {
    id: 'u_marco', workspace: 'internal', role: 'logistics',
    firstName: 'Marco', lastName: 'Riva', email: 'marco.riva@italprotein.com',
    jobTitle: 'Logistics Coordinator', avatarColor: '#2563eb',
    blurb: 'Prepares samples, books couriers and tracks shipments & customs.',
  },
  {
    id: 'u_elena', workspace: 'internal', role: 'finance',
    firstName: 'Elena', lastName: 'Brambilla', email: 'elena.brambilla@italprotein.com',
    jobTitle: 'Finance Manager', avatarColor: '#6f8a6b',
    blurb: 'Quotes, orders, invoices, payments and finance analytics.',
  },
  {
    id: 'u_davide', workspace: 'internal', role: 'management_readonly',
    firstName: 'Davide', lastName: 'Ferri', email: 'davide.ferri@italprotein.com',
    jobTitle: 'Managing Director', avatarColor: '#566b53',
    blurb: 'Read-only executive view across the whole CRM.',
  },

  /* ── External portal (The Protein Works) ── */
  {
    id: 'e_owner', workspace: 'external', role: 'company_owner', companyId: 'c_proteinworks',
    firstName: 'Sofia', lastName: 'Wade', email: 'sofia.wade@theproteinworks.com',
    jobTitle: 'Head of Product Development', avatarColor: '#1f6feb',
    blurb: 'Company owner — full portal access incl. sensitive edits and team.',
  },
  {
    id: 'e_member', workspace: 'external', role: 'company_member', companyId: 'c_proteinworks',
    firstName: 'James', lastName: 'Carter', email: 'james.carter@theproteinworks.com',
    jobTitle: 'Brand Manager', avatarColor: '#3b82f6',
    blurb: 'General team member — can request samples and submit feedback.',
  },
  {
    id: 'e_tech', workspace: 'external', role: 'company_technical', companyId: 'c_proteinworks',
    firstName: 'Olivia', lastName: 'Bennett', email: 'olivia.bennett@theproteinworks.com',
    jobTitle: 'R&D Scientist', avatarColor: '#0eb89a',
    blurb: 'Technical contact — owns feedback, projects and test results.',
  },
  {
    id: 'e_log', workspace: 'external', role: 'company_logistics', companyId: 'c_proteinworks',
    firstName: 'Daniel', lastName: 'Hughes', email: 'daniel.hughes@theproteinworks.com',
    jobTitle: 'Supply Chain Coordinator', avatarColor: '#f59e0b',
    blurb: 'Logistics contact — sample requests, shipments and delivery confirmation.',
  },
  {
    id: 'e_fin', workspace: 'external', role: 'company_finance', companyId: 'c_proteinworks',
    firstName: 'Grace', lastName: 'Mitchell', email: 'grace.mitchell@theproteinworks.com',
    jobTitle: 'Finance Officer', avatarColor: '#6f8a6b',
    blurb: 'Finance contact — documents, quotes and finance-facing items.',
  },
];

export function getDemoAccounts(): DemoAccount[] {
  return DEMO_ACCOUNTS;
}
