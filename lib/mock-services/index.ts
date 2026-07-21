/**
 * Mock service layer — the single seam between the UI and data.
 *
 * Components import services from here ONLY (never raw fixtures). Each service
 * exposes async methods backed by seeded fixtures + a localStorage overlay.
 * Replacing these implementations with real API/server-action calls connects a
 * production backend without touching the UI. See docs/BACKEND_HANDOFF.md.
 */
export { createRepository } from './repository';
export type { Repository, Identified } from './repository';

export { authService } from './authService';

// ── Data-mode switch ──────────────────────────────────────────────────────
// Migrated services resolve to their real (Prisma-backed) implementation when
// NEXT_PUBLIC_DATA_MODE=api, and the mock/fixture implementation otherwise.
// Unmigrated services below are still mock-only.
import { companyService as mockCompanyService } from './companyService';
import { companyService as apiCompanyService } from '@/lib/services/company';
import { sampleService as mockSampleService } from './sampleService';
import { sampleService as apiSampleService } from '@/lib/services/sample';
import { contactService as mockContactService } from './contactService';
import { contactService as apiContactService } from '@/lib/services/contact';
import { opportunityService as mockOpportunityService } from './opportunityService';
import { opportunityService as apiOpportunityService } from '@/lib/services/opportunity';
import { shipmentService as mockShipmentService } from './shipmentService';
import { shipmentService as apiShipmentService } from '@/lib/services/shipment';
import { ndaService as mockNdaService } from './ndaService';
import { ndaService as apiNdaService } from '@/lib/services/nda';
import { documentService as mockDocumentService } from './documentService';
import { documentService as apiDocumentService } from '@/lib/services/document';
import { activityService as mockActivityService } from './activityService';
import { activityService as apiActivityService } from '@/lib/services/activity';
import { taskService as mockTaskService } from './taskService';
import { taskService as apiTaskService } from '@/lib/services/task';
import { meetingService as mockMeetingService } from './meetingService';
import { meetingService as apiMeetingService } from '@/lib/services/meeting';
import { feedbackService as mockFeedbackService } from './feedbackService';
import { feedbackService as apiFeedbackService } from '@/lib/services/feedback';
import { notificationService as mockNotificationService } from './notificationService';
import { notificationService as apiNotificationService } from '@/lib/services/notification';
import { registrationService as mockRegistrationService } from './registrationService';
import { registrationService as apiRegistrationService } from '@/lib/services/registration';
import { supportService as mockSupportService } from './supportService';
import { supportService as apiSupportService } from '@/lib/services/support';
import { financeService as mockFinanceService } from './financeService';
import { financeService as apiFinanceService } from '@/lib/services/finance';
import { projectService as mockProjectService } from './projectService';
import { projectService as apiProjectService } from '@/lib/services/project';
import { productService as mockProductService } from './productService';
import { productService as apiProductService } from '@/lib/services/product';
import { userService as mockUserService } from './userService';
import { userService as apiUserService } from '@/lib/services/user';
import { agencyService as mockAgencyService } from './agencyService';
import { agencyService as apiAgencyService } from '@/lib/services/agency';
import { analyticsService as mockAnalyticsService } from './analyticsService';
import { analyticsService as apiAnalyticsService } from '@/lib/services/analytics';
import { emailService as mockEmailService } from './emailService';
import { emailService as apiEmailService } from '@/lib/services/email';
import { leadService as mockLeadService } from './leadService';
import { leadService as apiLeadService } from '@/lib/services/lead';
const isApiMode = (process.env.NEXT_PUBLIC_DATA_MODE ?? 'mock') === 'api';
export const companyService = isApiMode ? apiCompanyService : mockCompanyService;
export const sampleService = isApiMode ? apiSampleService : mockSampleService;
export type { CompanyQuery } from './companyService';

export const contactService = isApiMode ? apiContactService : mockContactService;
export const opportunityService = isApiMode ? apiOpportunityService : mockOpportunityService;
export const shipmentService = isApiMode ? apiShipmentService : mockShipmentService;
export { deriveShipmentStatus } from './shipmentService';
export type { DerivedShipmentStatus } from './shipmentService';
export const ndaService = isApiMode ? apiNdaService : mockNdaService;
export const documentService = isApiMode ? apiDocumentService : mockDocumentService;
export const activityService = isApiMode ? apiActivityService : mockActivityService;
export const taskService = isApiMode ? apiTaskService : mockTaskService;
export const meetingService = isApiMode ? apiMeetingService : mockMeetingService;
export const feedbackService = isApiMode ? apiFeedbackService : mockFeedbackService;
export const notificationService = isApiMode ? apiNotificationService : mockNotificationService;
export type { AudienceQuery } from './notificationService';
export const registrationService = isApiMode ? apiRegistrationService : mockRegistrationService;
export const supportService = isApiMode ? apiSupportService : mockSupportService;
export const financeService = isApiMode ? apiFinanceService : mockFinanceService;
export const projectService = isApiMode ? apiProjectService : mockProjectService;
export const productService = isApiMode ? apiProductService : mockProductService;
export const userService = isApiMode ? apiUserService : mockUserService;
export const agencyService = isApiMode ? apiAgencyService : mockAgencyService;
export type { Agency } from './agencyService';
export const analyticsService = isApiMode ? apiAnalyticsService : mockAnalyticsService;
export const emailService = isApiMode ? apiEmailService : mockEmailService;
export const leadService = isApiMode ? apiLeadService : mockLeadService;
