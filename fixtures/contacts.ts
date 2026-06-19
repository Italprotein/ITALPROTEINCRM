import type { Contact } from '@/lib/types';

/**
 * Mock contacts for the ITALPROTEIN CRM prototype.
 *
 * Names match each company's country; everything else is fictional demo data.
 * The four c_proteinworks portal people (ct_pw_1..4) mirror the external demo
 * accounts in fixtures/users.ts and carry the role flags the portal relies on.
 */
export const CONTACTS: Contact[] = [
  /* ───────── The Protein Works — portal people (ct_pw_1..4) ───────── */
  {
    id: 'ct_pw_1', companyId: 'c_proteinworks',
    firstName: 'Sofia', lastName: 'Wade', jobTitle: 'Head of Product Development',
    department: 'R&D', businessRole: 'Product lead', decisionRole: 'decision_maker',
    email: 'sofia.wade@theproteinworks.com', phone: '+44 151 909 1010', mobile: '+44 7700 900112',
    linkedin: 'https://www.linkedin.com/in/sofia-wade-pw',
    country: 'United Kingdom', countryCode: 'GB', timezone: 'Europe/London', preferredLanguage: 'en',
    isPrimary: true, isCommercial: true,
    communicationPreferences: ['email', 'video_call'],
    lastContactAt: '2026-06-10', ownerId: 'u_ludwig',
    notes: 'Primary portal owner. Drives the reduced-sugar protein range.',
    portalAccountId: 'e_owner', createdAt: '2025-11-18',
  },
  {
    id: 'ct_pw_2', companyId: 'c_proteinworks',
    firstName: 'Olivia', lastName: 'Bennett', jobTitle: 'R&D Scientist',
    department: 'R&D', businessRole: 'Application development', decisionRole: 'influencer',
    email: 'olivia.bennett@theproteinworks.com', phone: '+44 151 909 1015',
    country: 'United Kingdom', countryCode: 'GB', timezone: 'Europe/London', preferredLanguage: 'en',
    isTechnical: true,
    communicationPreferences: ['email'],
    lastContactAt: '2026-06-09', ownerId: 'u_ahmed',
    notes: 'Technical contact — owns feedback and lab results.',
    portalAccountId: 'e_tech', createdAt: '2025-11-20',
  },
  {
    id: 'ct_pw_3', companyId: 'c_proteinworks',
    firstName: 'Daniel', lastName: 'Hughes', jobTitle: 'Supply Chain Coordinator',
    department: 'Operations', businessRole: 'Logistics', decisionRole: 'user',
    email: 'daniel.hughes@theproteinworks.com', phone: '+44 151 909 1020',
    country: 'United Kingdom', countryCode: 'GB', timezone: 'Europe/London', preferredLanguage: 'en',
    isLogistics: true,
    communicationPreferences: ['email', 'phone'],
    lastContactAt: '2026-06-04', ownerId: 'u_marco',
    notes: 'Handles goods-in scheduling and delivery confirmation.',
    portalAccountId: 'e_log', createdAt: '2025-11-25',
  },
  {
    id: 'ct_pw_4', companyId: 'c_proteinworks',
    firstName: 'Grace', lastName: 'Mitchell', jobTitle: 'Finance Officer',
    department: 'Finance', businessRole: 'Accounts payable', decisionRole: 'gatekeeper',
    email: 'grace.mitchell@theproteinworks.com', phone: '+44 151 909 1025',
    country: 'United Kingdom', countryCode: 'GB', timezone: 'Europe/London', preferredLanguage: 'en',
    isFinance: true,
    communicationPreferences: ['email'],
    lastContactAt: '2026-05-30', ownerId: 'u_elena',
    notes: 'Finance contact for quotes and invoices.',
    portalAccountId: 'e_fin', createdAt: '2025-12-02',
  },

  /* ───────── Venchi ───────── */
  {
    id: 'ct_venchi_1', companyId: 'c_venchi',
    firstName: 'Giulia', lastName: 'Marchetti', jobTitle: 'R&D Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'g.marchetti@venchi.com', phone: '+39 0171 920100', mobile: '+39 333 1102233',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-08', ownerId: 'u_giuseppe',
    notes: 'Met at SIGEP Rimini; leads reduced-sugar praline project.',
    createdAt: '2026-02-12',
  },
  {
    id: 'ct_venchi_2', companyId: 'c_venchi',
    firstName: 'Lorenzo', lastName: 'Cavallo', jobTitle: 'Procurement Director',
    department: 'Purchasing', decisionRole: 'gatekeeper',
    email: 'l.cavallo@venchi.com', phone: '+39 0171 920120',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isCommercial: true,
    lastContactAt: '2026-05-22', ownerId: 'u_giuseppe',
    createdAt: '2026-03-04',
  },

  /* ───────── Barilla ───────── */
  {
    id: 'ct_barilla_1', companyId: 'c_barilla',
    firstName: 'Elena', lastName: 'Conti', jobTitle: 'Head of Snacking Innovation',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'elena.conti@barilla.com', phone: '+39 0521 2621', mobile: '+39 348 5567788',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-11', ownerId: 'u_giuseppe',
    notes: 'Snacking innovation team; protein breakfast biscuit concept.',
    createdAt: '2026-03-03',
  },
  {
    id: 'ct_barilla_2', companyId: 'c_barilla',
    firstName: 'Tommaso', lastName: 'Ricci', jobTitle: 'Legal Counsel',
    department: 'Legal', decisionRole: 'gatekeeper',
    email: 'tommaso.ricci@barilla.com', phone: '+39 0521 262200',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isLegal: true,
    lastContactAt: '2026-06-05', ownerId: 'u_giuseppe',
    notes: 'Reviewing the mutual NDA redlines.',
    createdAt: '2026-04-10',
  },
  {
    id: 'ct_barilla_3', companyId: 'c_barilla',
    firstName: 'Francesca', lastName: 'Lombardi', jobTitle: 'R&D Technologist',
    department: 'R&D', decisionRole: 'user',
    email: 'francesca.lombardi@barilla.com', phone: '+39 0521 262210',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isTechnical: true,
    lastContactAt: '2026-06-01', ownerId: 'u_ahmed',
    createdAt: '2026-04-12',
  },

  /* ───────── Galbusera ───────── */
  {
    id: 'ct_galbusera_1', companyId: 'c_galbusera',
    firstName: 'Paolo', lastName: 'Restelli', jobTitle: 'Innovation Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'p.restelli@galbusera.it', phone: '+39 0342 633011', mobile: '+39 347 2231144',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-05-30', ownerId: 'u_giuseppe',
    createdAt: '2026-04-21',
  },

  /* ───────── Colussi ───────── */
  {
    id: 'ct_colussi_1', companyId: 'c_colussi',
    firstName: 'Marco', lastName: 'Tessari', jobTitle: 'Category Development Manager',
    department: 'Marketing', decisionRole: 'champion',
    email: 'm.tessari@colussigroup.it', phone: '+39 02 27071', mobile: '+39 340 8899001',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-05-26', ownerId: 'u_giuseppe',
    notes: 'Met at TUTTOFOOD Milano; protein rusk concept.',
    createdAt: '2026-05-09',
  },

  /* ───────── Fabbri 1905 ───────── */
  {
    id: 'ct_fabbri_1', companyId: 'c_fabbri',
    firstName: 'Chiara', lastName: 'Fabbri', jobTitle: 'New Products Director',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'c.fabbri@fabbri1905.com', phone: '+39 051 6173311', mobile: '+39 335 1199002',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-06-05', ownerId: 'u_giuseppe',
    createdAt: '2026-01-28',
  },
  {
    id: 'ct_fabbri_2', companyId: 'c_fabbri',
    firstName: 'Alberto', lastName: 'Neri', jobTitle: 'Quality & Legal Affairs',
    department: 'Legal', decisionRole: 'gatekeeper',
    email: 'a.neri@fabbri1905.com', phone: '+39 051 6173320',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isLegal: true,
    lastContactAt: '2026-05-28', ownerId: 'u_giuseppe',
    notes: 'Requested NDA modifications (governing law).',
    createdAt: '2026-02-15',
  },

  /* ───────── ABS Food ───────── */
  {
    id: 'ct_absfood_1', companyId: 'c_absfood',
    firstName: 'Stefano', lastName: 'Bonato', jobTitle: 'Managing Director',
    department: 'Management', decisionRole: 'decision_maker',
    email: 's.bonato@absfood.it', phone: '+39 049 8930011', mobile: '+39 348 7711223',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-06-09', ownerId: 'u_giuseppe',
    createdAt: '2026-03-19',
  },

  /* ───────── Casillo ───────── */
  {
    id: 'ct_casillo_1', companyId: 'c_casillo',
    firstName: 'Francesco', lastName: 'Casillo', jobTitle: 'Head of NextGen Food',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'f.casillo@casillogroup.com', phone: '+39 080 8721011', mobile: '+39 333 6677889',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-02', ownerId: 'u_ludwig',
    createdAt: '2026-02-25',
  },
  {
    id: 'ct_casillo_2', companyId: 'c_casillo',
    firstName: 'Antonella', lastName: 'Greco', jobTitle: 'R&D Technologist',
    department: 'R&D', decisionRole: 'user',
    email: 'a.greco@casillogroup.com', phone: '+39 080 8721020',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isTechnical: true,
    lastContactAt: '2026-05-20', ownerId: 'u_ahmed',
    createdAt: '2026-03-08',
  },

  /* ───────── Foodness ───────── */
  {
    id: 'ct_foodness_1', companyId: 'c_foodness',
    firstName: 'Luca', lastName: 'Negri', jobTitle: 'Product Development Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'l.negri@foodness.it', phone: '+39 0376 263011', mobile: '+39 340 5566778',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-05-22', ownerId: 'u_giuseppe',
    createdAt: '2026-04-02',
  },

  /* ───────── NaturaSì ───────── */
  {
    id: 'ct_naturasi_1', companyId: 'c_naturasi',
    firstName: 'Giovanni', lastName: 'Reghin', jobTitle: 'Private Label Manager',
    department: 'Purchasing', decisionRole: 'decision_maker',
    email: 'g.reghin@naturasi.it', phone: '+39 0438 4090', mobile: '+39 348 2233445',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-06-04', ownerId: 'u_ludwig',
    notes: 'Coordinates with Laboratorio ON for testing.',
    createdAt: '2026-03-11',
  },
  {
    id: 'ct_naturasi_2', companyId: 'c_naturasi',
    firstName: 'Beatrice', lastName: 'Fontana', jobTitle: 'Lab ON Technologist',
    department: 'R&D', decisionRole: 'user',
    email: 'b.fontana@naturasi.it', phone: '+39 0438 40920',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isTechnical: true,
    lastContactAt: '2026-05-28', ownerId: 'u_ahmed',
    createdAt: '2026-03-18',
  },

  /* ───────── Gimoka ───────── */
  {
    id: 'ct_gimoka_1', companyId: 'c_gimoka',
    firstName: 'Andrea', lastName: 'Mauri', jobTitle: 'R&D Coordinator',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'a.mauri@gimoka.it', phone: '+39 02 90659011', mobile: '+39 347 8801122',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-05-18', ownerId: 'u_giuseppe',
    createdAt: '2026-04-15',
  },

  /* ───────── Eurosup ───────── */
  {
    id: 'ct_eurosup_1', companyId: 'c_eurosup',
    firstName: 'Roberto', lastName: 'Galli', jobTitle: 'Purchasing Manager',
    department: 'Purchasing', decisionRole: 'decision_maker',
    email: 'r.galli@eurosup.it', phone: '+39 02 48400011', mobile: '+39 335 4455667',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-06-12', ownerId: 'u_giuseppe',
    notes: 'Repeat buyer; coordinates quarterly reorders.',
    createdAt: '2025-09-30',
  },
  {
    id: 'ct_eurosup_2', companyId: 'c_eurosup',
    firstName: 'Valentina', lastName: 'Moretti', jobTitle: 'Formulation Specialist',
    department: 'R&D', decisionRole: 'user',
    email: 'v.moretti@eurosup.it', phone: '+39 02 48400020',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isTechnical: true,
    lastContactAt: '2026-05-29', ownerId: 'u_ahmed',
    createdAt: '2025-10-12',
  },

  /* ───────── Prontofoods ───────── */
  {
    id: 'ct_prontofoods_1', companyId: 'c_prontofoods',
    firstName: 'Davide', lastName: 'Sala', jobTitle: 'Operations Manager',
    department: 'Operations', decisionRole: 'influencer',
    email: 'd.sala@prontofoods.it', phone: '+39 035 4567011', mobile: '+39 348 9900112',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-05-28', ownerId: 'u_giuseppe',
    createdAt: '2026-05-20',
  },

  /* ───────── Silvio Panettieri ───────── */
  {
    id: 'ct_panettieri_1', companyId: 'c_panettieri',
    firstName: 'Silvio', lastName: 'Panettieri', jobTitle: 'Owner & Master Pastry Chef',
    department: 'Management', decisionRole: 'decision_maker',
    email: 'silvio@pasticceriapanettieri.it', phone: '+39 089 234011', mobile: '+39 333 7788990',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-06-06', ownerId: 'u_giuseppe',
    createdAt: '2026-04-28',
  },

  /* ───────── Vegamore ───────── */
  {
    id: 'ct_vegamore_1', companyId: 'c_vegamore',
    firstName: 'Sara', lastName: 'Verdi', jobTitle: 'Founder',
    department: 'Management', decisionRole: 'decision_maker',
    email: 'sara@vegamore.it', phone: '+39 02 36005011', mobile: '+39 347 1122334',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-06-07', ownerId: 'u_giuseppe',
    createdAt: '2026-05-02',
  },

  /* ───────── Icedog ───────── */
  {
    id: 'ct_icedog_1', companyId: 'c_icedog',
    firstName: 'Matteo', lastName: 'Bianchi', jobTitle: 'Head Gelato Maker',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'm.bianchi@icedog.it', phone: '+39 0541 390011', mobile: '+39 335 6677889',
    country: 'Italy', countryCode: 'IT', timezone: 'Europe/Rome', preferredLanguage: 'it',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-03', ownerId: 'u_giuseppe',
    createdAt: '2026-01-20',
  },

  /* ───────── Südzucker ───────── */
  {
    id: 'ct_sudzucker_1', companyId: 'c_sudzucker',
    firstName: 'Klaus', lastName: 'Berger', jobTitle: 'Head of Application Development',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'klaus.berger@suedzucker.de', phone: '+49 621 4210', mobile: '+49 172 4455667',
    country: 'Germany', countryCode: 'DE', timezone: 'Europe/Berlin', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-13', ownerId: 'u_ludwig',
    notes: 'Strategic ingredient co-development discussion.',
    createdAt: '2025-12-05',
  },
  {
    id: 'ct_sudzucker_2', companyId: 'c_sudzucker',
    firstName: 'Petra', lastName: 'Hoffmann', jobTitle: 'Strategic Sourcing Lead',
    department: 'Purchasing', decisionRole: 'gatekeeper',
    email: 'petra.hoffmann@suedzucker.de', phone: '+49 621 4220',
    country: 'Germany', countryCode: 'DE', timezone: 'Europe/Berlin', preferredLanguage: 'en',
    isCommercial: true,
    lastContactAt: '2026-06-02', ownerId: 'u_ludwig',
    createdAt: '2026-01-14',
  },

  /* ───────── Ehrmann ───────── */
  {
    id: 'ct_ehrmann_1', companyId: 'c_ehrmann',
    firstName: 'Anja', lastName: 'Vogt', jobTitle: 'R&D Project Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'anja.vogt@ehrmann.de', phone: '+49 8333 3010', mobile: '+49 171 2233445',
    country: 'Germany', countryCode: 'DE', timezone: 'Europe/Berlin', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-01', ownerId: 'u_ludwig',
    notes: 'Requested docs + sample; shipping address pending.',
    createdAt: '2026-02-18',
  },

  /* ───────── Layenberger ───────── */
  {
    id: 'ct_layenberger_1', companyId: 'c_layenberger',
    firstName: 'Markus', lastName: 'Lang', jobTitle: 'Head of Development',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'markus.lang@layenberger.de', phone: '+49 7024 80110', mobile: '+49 172 9988776',
    country: 'Germany', countryCode: 'DE', timezone: 'Europe/Berlin', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-05-27', ownerId: 'u_ludwig',
    createdAt: '2026-05-14',
  },

  /* ───────── Emmi ───────── */
  {
    id: 'ct_emmi_1', companyId: 'c_emmi',
    firstName: 'Jasmin', lastName: 'Riedweg', jobTitle: 'Innovation Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'jasmin.riedweg@emmi.com', phone: '+41 58 227 2727', mobile: '+41 79 445 6677',
    country: 'Switzerland', countryCode: 'CH', timezone: 'Europe/Zurich', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-09', ownerId: 'u_ludwig',
    notes: 'Protein coffee drinks; lab results pending.',
    createdAt: '2026-01-15',
  },
  {
    id: 'ct_emmi_2', companyId: 'c_emmi',
    firstName: 'Thomas', lastName: 'Keller', jobTitle: 'Procurement Manager',
    department: 'Purchasing', decisionRole: 'gatekeeper',
    email: 'thomas.keller@emmi.com', phone: '+41 58 227 2730',
    country: 'Switzerland', countryCode: 'CH', timezone: 'Europe/Zurich', preferredLanguage: 'en',
    isCommercial: true,
    lastContactAt: '2026-05-26', ownerId: 'u_ludwig',
    createdAt: '2026-02-10',
  },

  /* ───────── NÖM ───────── */
  {
    id: 'ct_nom_1', companyId: 'c_nom',
    firstName: 'Clemens', lastName: 'Gmainer', jobTitle: 'Head of Product Development',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'clemens.gmainer@noem.at', phone: '+43 2252 4020', mobile: '+43 664 1122334',
    country: 'Austria', countryCode: 'AT', timezone: 'Europe/Vienna', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-10', ownerId: 'u_ludwig',
    notes: '10kg sample requested for protein milk drinks.',
    createdAt: '2026-02-02',
  },

  /* ───────── Groupe Bel ───────── */
  {
    id: 'ct_bel_1', companyId: 'c_bel',
    firstName: 'David', lastName: 'Laino', jobTitle: 'R&D Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'david.laino@groupe-bel.com', phone: '+33 1 5510 4100', mobile: '+33 6 1122 3344',
    country: 'France', countryCode: 'FR', timezone: 'Europe/Paris', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-11', ownerId: 'u_ludwig',
    notes: '15kg R&D sample for fruit-dairy protein snacks.',
    createdAt: '2025-12-18',
  },
  {
    id: 'ct_bel_2', companyId: 'c_bel',
    firstName: 'Camille', lastName: 'Rousseau', jobTitle: 'Procurement Director',
    department: 'Purchasing', decisionRole: 'gatekeeper',
    email: 'camille.rousseau@groupe-bel.com', phone: '+33 1 5510 4120',
    country: 'France', countryCode: 'FR', timezone: 'Europe/Paris', preferredLanguage: 'en',
    isCommercial: true,
    lastContactAt: '2026-05-30', ownerId: 'u_ludwig',
    createdAt: '2026-01-20',
  },

  /* ───────── Nutrimuscle ───────── */
  {
    id: 'ct_nutrimuscle_1', companyId: 'c_nutrimuscle',
    firstName: 'Julien', lastName: 'Moreau', jobTitle: 'Head of R&D',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'julien.moreau@nutrimuscle.com', phone: '+32 2 555 1010', mobile: '+32 470 11 22 33',
    country: 'Belgium', countryCode: 'BE', timezone: 'Europe/Brussels', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-05-29', ownerId: 'u_ludwig',
    createdAt: '2026-03-07',
  },

  /* ───────── Funky Veggie ───────── */
  {
    id: 'ct_funkyveggie_1', companyId: 'c_funkyveggie',
    firstName: 'Camille', lastName: 'Dubois', jobTitle: 'Co-founder & Product',
    department: 'Management', decisionRole: 'decision_maker',
    email: 'camille@funkyveggie.fr', phone: '+33 1 4488 1010', mobile: '+33 6 9988 7766',
    country: 'France', countryCode: 'FR', timezone: 'Europe/Paris', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-05-21', ownerId: 'u_ludwig',
    createdAt: '2026-04-09',
  },

  /* ───────── Funky Fat Foods ───────── */
  {
    id: 'ct_funkyfat_1', companyId: 'c_funkyfat',
    firstName: 'Tim', lastName: 'Jansen', jobTitle: 'Founder',
    department: 'Management', decisionRole: 'decision_maker',
    email: 'tim@funkyfatfoods.com', phone: '+31 20 555 1010', mobile: '+31 6 11 22 33 44',
    country: 'Netherlands', countryCode: 'NL', timezone: 'Europe/Amsterdam', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-05-15', ownerId: 'u_ludwig',
    createdAt: '2026-05-06',
  },

  /* ───────── Yoplait / Liberté ───────── */
  {
    id: 'ct_yoplait_1', companyId: 'c_yoplait',
    firstName: 'Sophie', lastName: 'Laurent', jobTitle: 'Senior R&D Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'sophie.laurent@yoplait.com', phone: '+33 1 7000 1010', mobile: '+33 6 4455 6677',
    country: 'France', countryCode: 'FR', timezone: 'Europe/Paris', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-05-24', ownerId: 'u_ludwig',
    createdAt: '2026-03-25',
  },

  /* ───────── Nick's ───────── */
  {
    id: 'ct_nicks_1', companyId: 'c_nicks',
    firstName: 'Erik', lastName: 'Lennartsson', jobTitle: 'Head of Product',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'erik.lennartsson@nicks.com', phone: '+46 8 555 1010', mobile: '+46 70 112 2334',
    country: 'Sweden', countryCode: 'SE', timezone: 'Europe/Stockholm', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-05', ownerId: 'u_ludwig',
    createdAt: '2026-02-28',
  },
  {
    id: 'ct_nicks_2', companyId: 'c_nicks',
    firstName: 'Anna', lastName: 'Bergström', jobTitle: 'Supply Chain Manager',
    department: 'Operations', decisionRole: 'user',
    email: 'anna.bergstrom@nicks.com', phone: '+46 8 555 1020',
    country: 'Sweden', countryCode: 'SE', timezone: 'Europe/Stockholm', preferredLanguage: 'en',
    isLogistics: true,
    lastContactAt: '2026-05-20', ownerId: 'u_marco',
    createdAt: '2026-03-12',
  },

  /* ───────── Disproquima ───────── */
  {
    id: 'ct_disproquima_1', companyId: 'c_disproquima',
    firstName: 'Marta', lastName: 'Soler', jobTitle: 'Business Development Director',
    department: 'Commercial', decisionRole: 'decision_maker',
    email: 'marta.soler@disproquima.com', phone: '+34 93 555 1010', mobile: '+34 600 112 233',
    country: 'Spain', countryCode: 'ES', timezone: 'Europe/Madrid', preferredLanguage: 'en',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-06-12', ownerId: 'u_ludwig',
    notes: 'Potential Iberian distribution partner.',
    createdAt: '2026-01-31',
  },
  {
    id: 'ct_disproquima_2', companyId: 'c_disproquima',
    firstName: 'Jorge', lastName: 'Ferrer', jobTitle: 'Technical Sales',
    department: 'Commercial', decisionRole: 'influencer',
    email: 'jorge.ferrer@disproquima.com', phone: '+34 93 555 1020',
    country: 'Spain', countryCode: 'ES', timezone: 'Europe/Madrid', preferredLanguage: 'en',
    isTechnical: true,
    lastContactAt: '2026-05-25', ownerId: 'u_ludwig',
    createdAt: '2026-02-12',
  },

  /* ───────── Prinova ───────── */
  {
    id: 'ct_prinova_1', companyId: 'c_prinova',
    firstName: 'Daniel', lastName: 'Price', jobTitle: 'Category Manager — Proteins',
    department: 'Commercial', decisionRole: 'decision_maker',
    email: 'daniel.price@prinovaglobal.com', phone: '+44 161 555 1010', mobile: '+44 7700 900345',
    country: 'United Kingdom', countryCode: 'GB', timezone: 'Europe/London', preferredLanguage: 'en',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-05-31', ownerId: 'u_ludwig',
    createdAt: '2026-04-12',
  },

  /* ───────── Suntory ───────── */
  {
    id: 'ct_suntory_1', companyId: 'c_suntory',
    firstName: 'Rachel', lastName: 'Thompson', jobTitle: 'Innovation Lead',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'rachel.thompson@suntory.com', phone: '+44 20 8987 1010', mobile: '+44 7700 900456',
    country: 'United Kingdom', countryCode: 'GB', timezone: 'Europe/London', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-06-08', ownerId: 'u_ludwig',
    notes: 'Sample exchange planned in London; address pending.',
    createdAt: '2026-03-14',
  },

  /* ───────── Al Ain Farms ───────── */
  {
    id: 'ct_alainfarms_1', companyId: 'c_alainfarms',
    firstName: 'Omar', lastName: 'Al Mansoori', jobTitle: 'R&D Director',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'omar.almansoori@alainfarms.com', phone: '+971 3 721 1010', mobile: '+971 50 112 2334',
    country: 'United Arab Emirates', countryCode: 'AE', timezone: 'Asia/Dubai', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-06-02', ownerId: 'u_ludwig',
    createdAt: '2026-02-09',
  },

  /* ───────── Almarai ───────── */
  {
    id: 'ct_almarai_1', companyId: 'c_almarai',
    firstName: 'Yusuf', lastName: 'Khan', jobTitle: 'Head of Innovation',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'yusuf.khan@almarai.com', phone: '+966 11 470 1010', mobile: '+966 50 112 2334',
    country: 'Saudi Arabia', countryCode: 'SA', timezone: 'Asia/Riyadh', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-05-28', ownerId: 'u_ludwig',
    notes: 'Mutual NDA executed; defining sample scope.',
    createdAt: '2026-01-22',
  },

  /* ───────── Milaf ───────── */
  {
    id: 'ct_milaf_1', companyId: 'c_milaf',
    firstName: 'Fahad', lastName: 'Al Otaibi', jobTitle: 'Product Manager',
    department: 'Commercial', decisionRole: 'champion',
    email: 'fahad.alotaibi@milaf.com', phone: '+966 13 580 1010', mobile: '+966 55 112 2334',
    country: 'Saudi Arabia', countryCode: 'SA', timezone: 'Asia/Riyadh', preferredLanguage: 'en',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-05-12', ownerId: 'u_ludwig',
    createdAt: '2026-04-18',
  },

  /* ───────── Ascom Gum ───────── */
  {
    id: 'ct_ascomgum_1', companyId: 'c_ascomgum',
    firstName: 'Mehmet', lastName: 'Yıldız', jobTitle: 'R&D Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'mehmet.yildiz@ascomgum.com', phone: '+90 342 337 1010', mobile: '+90 532 112 2334',
    country: 'Türkiye', countryCode: 'TR', timezone: 'Europe/Istanbul', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true,
    lastContactAt: '2026-05-19', ownerId: 'u_ludwig',
    createdAt: '2026-03-29',
  },

  /* ───────── Incredo ───────── */
  {
    id: 'ct_incredo_1', companyId: 'c_incredo',
    firstName: 'Noa', lastName: 'Levi', jobTitle: 'Partnerships Manager',
    department: 'Commercial', decisionRole: 'influencer',
    email: 'noa.levi@incredo.com', phone: '+972 9 555 1010', mobile: '+972 50 112 2334',
    country: 'Israel', countryCode: 'IL', timezone: 'Asia/Jerusalem', preferredLanguage: 'en',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-05-10', ownerId: 'u_ludwig',
    createdAt: '2026-05-05',
  },

  /* ───────── Nourish You ───────── */
  {
    id: 'ct_nourishyou_1', companyId: 'c_nourishyou',
    firstName: 'Aarav', lastName: 'Mehta', jobTitle: 'Head of Innovation',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'aarav.mehta@nourishyou.in', phone: '+91 40 4455 1010', mobile: '+91 98765 43210',
    country: 'India', countryCode: 'IN', timezone: 'Asia/Kolkata', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-05-08', ownerId: 'u_ludwig',
    createdAt: '2026-04-26',
  },

  /* ───────── Crave Eatables ───────── */
  {
    id: 'ct_crave_1', companyId: 'c_crave',
    firstName: 'Priya', lastName: 'Nair', jobTitle: 'Founder',
    department: 'Management', decisionRole: 'decision_maker',
    email: 'priya@craveeatables.in', phone: '+91 22 4455 1010', mobile: '+91 99876 54321',
    country: 'India', countryCode: 'IN', timezone: 'Asia/Kolkata', preferredLanguage: 'en',
    isPrimary: true, isCommercial: true,
    lastContactAt: '2026-01-09', ownerId: 'u_ludwig',
    notes: 'Dormant — re-engagement planned.',
    createdAt: '2025-10-14',
  },

  /* ───────── Innofoods ───────── */
  {
    id: 'ct_innofoods_1', companyId: 'c_innofoods',
    firstName: 'Ricardo', lastName: 'Sousa', jobTitle: 'R&D Manager',
    department: 'R&D', decisionRole: 'decision_maker',
    email: 'ricardo.sousa@innofood.pt', phone: '+351 22 555 1010', mobile: '+351 91 112 2334',
    country: 'Portugal', countryCode: 'PT', timezone: 'Europe/Lisbon', preferredLanguage: 'en',
    isPrimary: true, isTechnical: true, isCommercial: true,
    lastContactAt: '2026-05-30', ownerId: 'u_ludwig',
    createdAt: '2026-03-02',
  },
];

export function getContacts(): Contact[] {
  return CONTACTS;
}
