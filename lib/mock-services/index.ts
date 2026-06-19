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
export { companyService } from './companyService';
export type { CompanyQuery } from './companyService';

export { contactService } from './contactService';
export { opportunityService } from './opportunityService';
export { sampleService } from './sampleService';
export { shipmentService, deriveShipmentStatus } from './shipmentService';
export type { DerivedShipmentStatus } from './shipmentService';
export { ndaService } from './ndaService';
export { documentService } from './documentService';
export { activityService } from './activityService';
export { taskService } from './taskService';
export { meetingService } from './meetingService';
export { feedbackService } from './feedbackService';
export { notificationService } from './notificationService';
export type { AudienceQuery } from './notificationService';
export { registrationService } from './registrationService';
export { supportService } from './supportService';
export { financeService } from './financeService';
export { projectService } from './projectService';
export { productService } from './productService';
export { userService } from './userService';
export { agencyService } from './agencyService';
export type { Agency } from './agencyService';
export { analyticsService } from './analyticsService';
