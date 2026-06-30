/**
 * Barrel re-export for every mock fixture in the ITALPROTEIN CRM prototype.
 * Import from '@/fixtures' to access any fixture array, accessor, or the
 * StaffMember type / AGENCY_META map.
 */

export { COMPANIES, getCompanies } from './companies';
export { TEAM_ACCOUNTS, getTeamAccounts } from './users';
export { CONTACTS, getContacts } from './contacts';
export { OPPORTUNITIES, getOpportunities } from './opportunities';
export { SAMPLES, getSamples } from './samples';
export { SHIPMENTS, getShipments } from './shipments';
export { NDAS, getNDAs } from './ndas';
export { DOCUMENTS, getDocuments } from './documents';
export { TASKS, getTasks } from './tasks';
export { ACTIVITIES, getActivities } from './activities';
export { FEEDBACK, getFeedback } from './feedback';
export { NOTIFICATIONS, getNotifications } from './notifications';
export { REGISTRATIONS, getRegistrations } from './registrations';
export { MEETINGS, getMeetings } from './meetings';
export { SUPPORT_REQUESTS, getSupportRequests } from './support';
export { FINANCE_DOCS, getFinanceDocs } from './finance';
export { PROJECTS, getProjects } from './projects';
export { PRODUCTS, getProducts } from './products';
export { AGENCY_COMPANIES, AGENCY_META, getAgencyCompanies } from './agencies';
export { STAFF, getStaff } from './staff';
export type { StaffMember } from './staff';
