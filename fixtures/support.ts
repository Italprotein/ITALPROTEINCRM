import type { SupportRequest } from '@/lib/types';

/**
 * Mock support requests (REQ-2026-####). Valid companyId; category/status/priority
 * varied; conversation has 1-4 messages mixing staff (byUserId) and client
 * (byContactId). c_proteinworks has 2 (req_pw_1, req_pw_2).
 */
export const SUPPORT_REQUESTS: SupportRequest[] = [
  /* ───────── The Protein Works ───────── */
  {
    id: 'req_pw_1', reference: 'REQ-2026-0001', companyId: 'c_proteinworks', contactId: 'ct_pw_2',
    subject: 'Clarity in clear RTD format', category: 'technical_question',
    description: 'We see slight haze in our clear RTD shake using Proamina at 1.0%. What dosage avoids this?',
    priority: 'high', status: 'resolved', assignedOwnerId: 'u_ahmed',
    conversation: [
      { byContactId: 'ct_pw_2', body: 'Seeing haze in the clear format — recommended dosage?', at: '2026-06-09T16:00:00Z' },
      { byUserId: 'u_ahmed', body: 'Try 0.8% with a small amount of chelant; I can share a note.', at: '2026-06-10T09:15:00Z' },
      { byContactId: 'ct_pw_2', body: 'Perfect, please send the note.', at: '2026-06-10T10:00:00Z' },
      { byUserId: 'u_ahmed', body: 'Sent — see custom dosage recommendation in your documents.', at: '2026-06-11T09:30:00Z' },
    ],
    createdAt: '2026-06-09', resolvedDate: '2026-06-11',
  },
  {
    id: 'req_pw_2', reference: 'REQ-2026-0002', companyId: 'c_proteinworks', contactId: 'ct_pw_3',
    subject: 'Goods-in scheduling for 1kg sample', category: 'logistics_issue',
    description: 'Can the 1kg follow-up arrive on a Tuesday or Wednesday? Our goods-in is busy Mondays.',
    priority: 'medium', status: 'in_progress', assignedOwnerId: 'u_marco',
    conversation: [
      { byContactId: 'ct_pw_3', body: 'Please avoid Monday delivery for the 1kg sample.', at: '2026-06-05T10:30:00Z' },
      { byUserId: 'u_marco', body: 'Noted — I will book DHL for Tue/Wed delivery.', at: '2026-06-05T11:00:00Z' },
    ],
    createdAt: '2026-06-05', dueDate: '2026-06-20',
  },

  /* ───────── Others ───────── */
  {
    id: 'req_emmi_1', reference: 'REQ-2026-0003', companyId: 'c_emmi', contactId: 'ct_emmi_1',
    subject: 'Protein coffee dosage guidance', category: 'technical_question',
    description: 'Optimal Proamina dosage for a 200ml protein coffee with 8g protein?',
    priority: 'medium', status: 'in_progress', assignedOwnerId: 'u_ahmed',
    conversation: [
      { byContactId: 'ct_emmi_1', body: 'What dosage do you recommend for the coffee drink?', at: '2026-06-09T10:00:00Z' },
      { byUserId: 'u_ahmed', body: 'Starting at 0.9%; will confirm after your lab results.', at: '2026-06-09T13:00:00Z' },
    ],
    createdAt: '2026-06-09', dueDate: '2026-06-27',
  },
  {
    id: 'req_bel_1', reference: 'REQ-2026-0004', companyId: 'c_bel', contactId: 'ct_bel_1',
    subject: 'Larger sample to optimise dosage', category: 'sample_request',
    description: 'We need a 15kg sample to optimise dosage for the fruit-dairy snack.',
    priority: 'high', status: 'resolved', assignedOwnerId: 'u_ludwig',
    conversation: [
      { byContactId: 'ct_bel_1', body: 'Aftertaste at high dosage — can we get a larger sample?', at: '2026-04-20T14:30:00Z' },
      { byUserId: 'u_ludwig', body: 'Raised SR-2026-0019 for 15kg; shipping shortly.', at: '2026-05-15T09:30:00Z' },
    ],
    createdAt: '2026-04-20', resolvedDate: '2026-06-11',
  },
  {
    id: 'req_venchi_1', reference: 'REQ-2026-0005', companyId: 'c_venchi', contactId: 'ct_venchi_1',
    subject: 'COA for 6kg praline batch', category: 'documentation_request',
    description: 'Please send the Certificate of Analysis for the 6kg praline sample lot.',
    priority: 'medium', status: 'resolved', assignedOwnerId: 'u_ahmed',
    conversation: [
      { byContactId: 'ct_venchi_1', body: 'Need the COA for QA records.', at: '2026-06-08T11:00:00Z' },
      { byUserId: 'u_ahmed', body: 'COA uploaded to your documents.', at: '2026-06-08T15:00:00Z' },
    ],
    createdAt: '2026-06-08', resolvedDate: '2026-06-08',
  },
  {
    id: 'req_sudzucker_1', reference: 'REQ-2026-0006', companyId: 'c_sudzucker', contactId: 'ct_sudzucker_1',
    subject: 'Regulatory dossier for EU', category: 'regulatory_request',
    description: 'Can you share the EU regulatory dossier and labelling guidance?',
    priority: 'medium', status: 'waiting_on_client', assignedOwnerId: 'u_ahmed',
    conversation: [
      { byContactId: 'ct_sudzucker_1', body: 'We need the regulatory dossier for the co-development.', at: '2026-06-02T15:00:00Z' },
      { byUserId: 'u_ahmed', body: 'Shared the labelling guide; do you need country-specific detail?', at: '2026-06-03T10:00:00Z' },
    ],
    createdAt: '2026-06-02', dueDate: '2026-06-24',
  },
  {
    id: 'req_disproquima_1', reference: 'REQ-2026-0007', companyId: 'c_disproquima', contactId: 'ct_disproquima_1',
    subject: 'Distributor pricing structure', category: 'commercial_request',
    description: 'Please share the proposed distributor pricing and margin structure for Iberia.',
    priority: 'high', status: 'in_progress', assignedOwnerId: 'u_ludwig',
    conversation: [
      { byContactId: 'ct_disproquima_1', body: 'Ready to discuss commercials — pricing structure?', at: '2026-05-28T12:00:00Z' },
      { byUserId: 'u_ludwig', body: 'Drafting distribution terms; pro-forma sent.', at: '2026-06-12T10:00:00Z' },
    ],
    createdAt: '2026-05-28', dueDate: '2026-06-28',
  },
  {
    id: 'req_icedog_1', reference: 'REQ-2026-0008', companyId: 'c_icedog', contactId: 'ct_icedog_1',
    subject: 'Redelivery of failed sample', category: 'logistics_issue',
    description: 'Our second sample delivery failed — please rebook for this week.',
    priority: 'medium', status: 'in_progress', assignedOwnerId: 'u_marco',
    conversation: [
      { byContactId: 'ct_icedog_1', body: 'We missed the delivery — can you redeliver?', at: '2026-06-13T17:30:00Z' },
      { byUserId: 'u_marco', body: 'Redelivery booked for 18 Jun.', at: '2026-06-14T08:00:00Z' },
    ],
    createdAt: '2026-06-13', dueDate: '2026-06-18',
  },
  {
    id: 'req_nutrimuscle_1', reference: 'REQ-2026-0009', companyId: 'c_nutrimuscle', contactId: 'ct_nutrimuscle_1',
    subject: 'Flavour compatibility data', category: 'technical_question',
    description: 'Do you have vanilla flavour-system compatibility data for Proamina?',
    priority: 'medium', status: 'open', assignedOwnerId: 'u_ahmed',
    conversation: [
      { byContactId: 'ct_nutrimuscle_1', body: 'Need vanilla compatibility info before reformulating.', at: '2026-06-05T11:00:00Z' },
    ],
    createdAt: '2026-06-05', dueDate: '2026-06-22',
  },
  {
    id: 'req_ehrmann_1', reference: 'REQ-2026-0010', companyId: 'c_ehrmann', contactId: 'ct_ehrmann_1',
    subject: 'Sample shipping arrangements', category: 'logistics_issue',
    description: 'Confirming our goods-in address for the yogurt development sample.',
    priority: 'high', status: 'waiting_on_client', assignedOwnerId: 'u_marco',
    conversation: [
      { byUserId: 'u_marco', body: 'We need a confirmed goods-in address to ship.', at: '2026-06-01T09:00:00Z' },
      { byContactId: 'ct_ehrmann_1', body: 'Checking internally; will revert.', at: '2026-06-02T10:00:00Z' },
    ],
    createdAt: '2026-06-01', dueDate: '2026-06-18',
  },
  {
    id: 'req_almarai_1', reference: 'REQ-2026-0011', companyId: 'c_almarai', contactId: 'ct_almarai_1',
    subject: 'Halal documentation', category: 'documentation_request',
    description: 'Please provide halal certification for the scoping sample.',
    priority: 'high', status: 'resolved', assignedOwnerId: 'u_ahmed',
    conversation: [
      { byContactId: 'ct_almarai_1', body: 'Need halal docs before shipment.', at: '2026-05-18T10:00:00Z' },
      { byUserId: 'u_ahmed', body: 'Countersigned halal certificate uploaded.', at: '2026-05-20T10:00:00Z' },
    ],
    createdAt: '2026-05-18', resolvedDate: '2026-05-20',
  },
  {
    id: 'req_eurosup_1', reference: 'REQ-2026-0012', companyId: 'c_eurosup', contactId: 'ct_eurosup_1',
    subject: 'Meeting to discuss Q3 volumes', category: 'meeting_request',
    description: 'Requesting a call to confirm Q3 reorder volumes and pricing.',
    priority: 'medium', status: 'resolved', assignedOwnerId: 'u_giuseppe',
    conversation: [
      { byContactId: 'ct_eurosup_1', body: 'Can we schedule a Q3 review call?', at: '2026-06-08T09:00:00Z' },
      { byUserId: 'u_giuseppe', body: 'Booked for 12 Jun 09:30.', at: '2026-06-08T11:00:00Z' },
    ],
    createdAt: '2026-06-08', resolvedDate: '2026-06-12',
  },
  {
    id: 'req_funkyveggie_1', reference: 'REQ-2026-0013', companyId: 'c_funkyveggie', contactId: 'ct_funkyveggie_1',
    subject: 'NDA status', category: 'account_issue',
    description: 'Checking the status of our NDA — keen to receive samples.',
    priority: 'low', status: 'open', assignedOwnerId: 'u_ludwig',
    conversation: [
      { byContactId: 'ct_funkyveggie_1', body: 'Any update on the NDA?', at: '2026-06-15T10:00:00Z' },
    ],
    createdAt: '2026-06-15', dueDate: '2026-06-19',
  },
  {
    id: 'req_naturasi_1', reference: 'REQ-2026-0014', companyId: 'c_naturasi', contactId: 'ct_naturasi_1',
    subject: 'Lab ON receipt confirmation', category: 'other',
    description: 'Confirming the 500g sample arrived at Laboratorio ON.',
    priority: 'medium', status: 'waiting_on_client', assignedOwnerId: 'u_ludwig',
    conversation: [
      { byUserId: 'u_ludwig', body: 'Has Lab ON received the 500g sample?', at: '2026-06-06T10:00:00Z' },
    ],
    createdAt: '2026-06-06', dueDate: '2026-06-18',
  },
];

export function getSupportRequests(): SupportRequest[] {
  return SUPPORT_REQUESTS;
}
