import type { Shipment } from '@/lib/types';

/**
 * Mock shipments (SHP-2026-####). Each references a valid sampleRequestId and
 * the sample's companyId; status aligns with the linked sample's status in
 * fixtures/samples.ts (shipped / in_transit / delivered / customs_hold).
 */
export const SHIPMENTS: Shipment[] = [
  /* ───────── The Protein Works ───────── */
  {
    id: 'shp_pw_1', reference: 'SHP-2026-0001', sampleRequestId: 'sr_pw_1', companyId: 'c_proteinworks',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Olivia Bennett',
    address: { line1: 'PW Campus, 33 Speke Boulevard', city: 'Liverpool', region: 'Merseyside', postalCode: 'L24 9HZ', country: 'United Kingdom', countryCode: 'GB' },
    email: 'olivia.bennett@theproteinworks.com',
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146512345', trackingUrl: 'https://www.dhl.com/track?id=JD0146512345',
    shipmentDate: '2026-04-15', estimatedDelivery: '2026-04-22', actualDelivery: '2026-04-22',
    packageCount: 1, weightKg: 0.6, dimensions: '20x15x10cm', shippingCost: 48, currency: 'EUR',
    customsStatus: 'cleared', incoterm: 'DDP', eoriImportInfo: 'GB EORI on file',
    clientVisibleNotes: 'Delivered to goods-in; signed by O. Bennett.',
    createdAt: '2026-04-15',
  },
  {
    id: 'shp_pw_2', reference: 'SHP-2026-0002', sampleRequestId: 'sr_pw_2', companyId: 'c_proteinworks',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Olivia Bennett',
    address: { line1: 'PW Campus, 33 Speke Boulevard', city: 'Liverpool', region: 'Merseyside', postalCode: 'L24 9HZ', country: 'United Kingdom', countryCode: 'GB' },
    email: 'olivia.bennett@theproteinworks.com',
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146598765', trackingUrl: 'https://www.dhl.com/track?id=JD0146598765',
    shipmentDate: '2026-05-22', estimatedDelivery: '2026-05-28', actualDelivery: '2026-05-28',
    packageCount: 1, weightKg: 0.8, shippingCost: 50, currency: 'EUR',
    customsStatus: 'cleared', incoterm: 'DDP',
    createdAt: '2026-05-22',
  },
  {
    id: 'shp_pw_3', reference: 'SHP-2026-0003', sampleRequestId: 'sr_pw_4', companyId: 'c_proteinworks',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Olivia Bennett',
    address: { line1: 'PW Campus, 33 Speke Boulevard', city: 'Liverpool', region: 'Merseyside', postalCode: 'L24 9HZ', country: 'United Kingdom', countryCode: 'GB' },
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146511111', trackingUrl: 'https://www.dhl.com/track?id=JD0146511111',
    shipmentDate: '2026-01-24', estimatedDelivery: '2026-02-01', actualDelivery: '2026-02-01',
    packageCount: 1, weightKg: 0.3, shippingCost: 42, currency: 'EUR',
    customsStatus: 'cleared', incoterm: 'DDP',
    createdAt: '2026-01-24',
  },

  /* ───────── Venchi ───────── */
  {
    id: 'shp_venchi_1', reference: 'SHP-2026-0004', sampleRequestId: 'sr_venchi_1', companyId: 'c_venchi',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Giulia Marchetti',
    address: { line1: 'Via Venchi 1', city: 'Castelletto Stura', region: 'CN', postalCode: '12040', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026060801', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026060801',
    shipmentDate: '2026-06-08', estimatedDelivery: '2026-06-18',
    packageCount: 2, weightKg: 6.4, shippingCost: 22, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    clientVisibleNotes: 'In transit to Piedmont; delivery expected 18 Jun.',
    createdAt: '2026-06-08',
  },
  {
    id: 'shp_venchi_2', reference: 'SHP-2026-0005', sampleRequestId: 'sr_venchi_2', companyId: 'c_venchi',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Giulia Marchetti',
    address: { line1: 'Via Venchi 1', city: 'Castelletto Stura', region: 'CN', postalCode: '12040', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026042201', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026042201',
    shipmentDate: '2026-04-22', estimatedDelivery: '2026-04-30', actualDelivery: '2026-04-30',
    packageCount: 1, weightKg: 0.7, shippingCost: 14, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-04-22',
  },

  /* ───────── ABS Food ───────── */
  {
    id: 'shp_absfood_1', reference: 'SHP-2026-0006', sampleRequestId: 'sr_absfood_1', companyId: 'c_absfood',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Stefano Bonato',
    address: { line1: 'Via Spagna 22', city: 'Vigonza', region: 'PD', postalCode: '35010', country: 'Italy', countryCode: 'IT' },
    courier: 'TNT', service: 'Economy Express',
    trackingNumber: 'TNT2026060701', trackingUrl: 'https://www.tnt.com/track?con=TNT2026060701',
    shipmentDate: '2026-06-07', estimatedDelivery: '2026-06-16',
    packageCount: 1, weightKg: 0.4, shippingCost: 12, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-06-07',
  },

  /* ───────── NaturaSì ───────── */
  {
    id: 'shp_naturasi_1', reference: 'SHP-2026-0007', sampleRequestId: 'sr_naturasi_1', companyId: 'c_naturasi',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Beatrice Fontana (Lab ON)',
    address: { line1: 'Via Palù 23', city: 'San Vendemiano', region: 'TV', postalCode: '31020', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026060401', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026060401',
    shipmentDate: '2026-06-04', estimatedDelivery: '2026-06-12',
    packageCount: 1, weightKg: 0.6, shippingCost: 13, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-06-04',
  },

  /* ───────── Eurosup ───────── */
  {
    id: 'shp_eurosup_1', reference: 'SHP-2026-0008', sampleRequestId: 'sr_eurosup_1', companyId: 'c_eurosup',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Valentina Moretti',
    address: { line1: 'Via Galileo Galilei', city: 'Trezzano sul Naviglio', region: 'MI', postalCode: '20090', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026042201E', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026042201E',
    shipmentDate: '2026-04-22', estimatedDelivery: '2026-04-28', actualDelivery: '2026-04-28',
    packageCount: 2, weightKg: 2.2, shippingCost: 16, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-04-22',
  },
  {
    id: 'shp_eurosup_2', reference: 'SHP-2026-0009', sampleRequestId: 'sr_eurosup_2', companyId: 'c_eurosup',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Roberto Galli',
    address: { line1: 'Via Galileo Galilei', city: 'Trezzano sul Naviglio', region: 'MI', postalCode: '20090', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026021201', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026021201',
    shipmentDate: '2026-02-12', estimatedDelivery: '2026-02-20', actualDelivery: '2026-02-20',
    packageCount: 3, weightKg: 5.3, shippingCost: 24, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-02-12',
  },

  /* ───────── Panettieri ───────── */
  {
    id: 'shp_panettieri_1', reference: 'SHP-2026-0010', sampleRequestId: 'sr_panettieri_1', companyId: 'c_panettieri',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Silvio Panettieri',
    address: { line1: 'Corso Vittorio Emanuele', city: 'Salerno', region: 'SA', postalCode: '84121', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026052601', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026052601',
    shipmentDate: '2026-05-26', estimatedDelivery: '2026-06-02', actualDelivery: '2026-06-02',
    packageCount: 1, weightKg: 0.5, shippingCost: 15, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-05-26',
  },

  /* ───────── Vegamore ───────── */
  {
    id: 'shp_vegamore_1', reference: 'SHP-2026-0011', sampleRequestId: 'sr_vegamore_1', companyId: 'c_vegamore',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Sara Verdi',
    address: { line1: 'Via Torino', city: 'Milano', region: 'MI', postalCode: '20123', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'City Express',
    trackingNumber: 'GLSIT2026052202', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026052202',
    shipmentDate: '2026-05-22', estimatedDelivery: '2026-05-28', actualDelivery: '2026-05-28',
    packageCount: 1, weightKg: 0.4, shippingCost: 8, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-05-22',
  },

  /* ───────── Icedog ───────── */
  {
    id: 'shp_icedog_1', reference: 'SHP-2026-0012', sampleRequestId: 'sr_icedog_1', companyId: 'c_icedog',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Matteo Bianchi',
    address: { line1: 'Via del Gelato', city: 'Rimini', region: 'RN', postalCode: '47921', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026050801', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026050801',
    shipmentDate: '2026-05-08', estimatedDelivery: '2026-05-15', actualDelivery: '2026-05-15',
    packageCount: 1, weightKg: 1.1, shippingCost: 14, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-05-08',
  },
  {
    id: 'shp_icedog_2', reference: 'SHP-2026-0013', sampleRequestId: 'sr_icedog_2', companyId: 'c_icedog',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Matteo Bianchi',
    address: { line1: 'Via del Gelato', city: 'Rimini', region: 'RN', postalCode: '47921', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026060902', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026060902',
    shipmentDate: '2026-06-09', estimatedDelivery: '2026-06-13',
    packageCount: 1, weightKg: 0.6, shippingCost: 13, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    isDelayed: true, deliveryIssue: 'First delivery attempt failed — recipient absent. Redelivery booked for 18 Jun.',
    createdAt: '2026-06-09',
  },

  /* ───────── Südzucker ───────── */
  {
    id: 'shp_sudzucker_1', reference: 'SHP-2026-0014', sampleRequestId: 'sr_sudzucker_1', companyId: 'c_sudzucker',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Klaus Berger',
    address: { line1: 'Maximilianstraße 10', city: 'Mannheim', postalCode: '68165', country: 'Germany', countryCode: 'DE' },
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146540001', trackingUrl: 'https://www.dhl.com/track?id=JD0146540001',
    shipmentDate: '2026-04-03', estimatedDelivery: '2026-04-10', actualDelivery: '2026-04-10',
    packageCount: 1, weightKg: 2.3, shippingCost: 38, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-04-03',
  },
  {
    id: 'shp_sudzucker_2', reference: 'SHP-2026-0015', sampleRequestId: 'sr_sudzucker_2', companyId: 'c_sudzucker',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Klaus Berger',
    address: { line1: 'Maximilianstraße 10', city: 'Mannheim', postalCode: '68165', country: 'Germany', countryCode: 'DE' },
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146540002', trackingUrl: 'https://www.dhl.com/track?id=JD0146540002',
    shipmentDate: '2026-06-10', estimatedDelivery: '2026-06-17',
    packageCount: 1, weightKg: 1.2, shippingCost: 34, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-06-10',
  },

  /* ───────── Emmi (CH customs) ───────── */
  {
    id: 'shp_emmi_1', reference: 'SHP-2026-0016', sampleRequestId: 'sr_emmi_1', companyId: 'c_emmi',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Jasmin Riedweg',
    address: { line1: 'Seetalstrasse 200', city: 'Emmen', postalCode: '6032', country: 'Switzerland', countryCode: 'CH' },
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146550001', trackingUrl: 'https://www.dhl.com/track?id=JD0146550001',
    shipmentDate: '2026-05-10', estimatedDelivery: '2026-05-19', actualDelivery: '2026-05-20',
    packageCount: 1, weightKg: 1.3, shippingCost: 56, currency: 'EUR',
    customsStatus: 'cleared', incoterm: 'DAP', eoriImportInfo: 'CH import; commercial invoice attached.',
    customsDocuments: [{ id: 'att_emmi_ci', name: 'Commercial Invoice — Emmi.pdf', fileType: 'pdf', sizeKb: 120, uploadedAt: '2026-05-10' }],
    internalNotes: 'Cleared CH customs next day; minor 1-day delay.',
    createdAt: '2026-05-10',
  },

  /* ───────── Bel ───────── */
  {
    id: 'shp_bel_1', reference: 'SHP-2026-0017', sampleRequestId: 'sr_bel_1', companyId: 'c_bel',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'David Laino',
    address: { line1: '2 rue Rex Combs', city: 'Chef-du-Pont', postalCode: '50480', country: 'France', countryCode: 'FR' },
    courier: 'FedEx', service: 'International Priority',
    trackingNumber: 'FX772300011', trackingUrl: 'https://www.fedex.com/track?trknbr=FX772300011',
    shipmentDate: '2026-06-11', estimatedDelivery: '2026-06-17',
    packageCount: 3, weightKg: 15.8, shippingCost: 72, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-06-11',
  },
  {
    id: 'shp_bel_2', reference: 'SHP-2026-0018', sampleRequestId: 'sr_bel_2', companyId: 'c_bel',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'David Laino',
    address: { line1: '2 rue Rex Combs', city: 'Chef-du-Pont', postalCode: '50480', country: 'France', countryCode: 'FR' },
    courier: 'FedEx', service: 'International Priority',
    trackingNumber: 'FX772300002', trackingUrl: 'https://www.fedex.com/track?trknbr=FX772300002',
    shipmentDate: '2026-03-22', estimatedDelivery: '2026-03-30', actualDelivery: '2026-04-01',
    packageCount: 1, weightKg: 2.4, shippingCost: 40, currency: 'EUR',
    customsStatus: 'cleared', incoterm: 'DAP',
    isDelayed: true, deliveryIssue: 'Held 2 days at Roissy customs pending paperwork; cleared and delivered.',
    createdAt: '2026-03-22',
  },

  /* ───────── Nick's ───────── */
  {
    id: 'shp_nicks_1', reference: 'SHP-2026-0019', sampleRequestId: 'sr_nicks_1', companyId: 'c_nicks',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Erik Lennartsson',
    address: { line1: 'Landsvägen 37', city: 'Sundbyberg', postalCode: '17263', country: 'Sweden', countryCode: 'SE' },
    courier: 'UPS', service: 'Express Saver',
    trackingNumber: '1Z9990W1234567890', trackingUrl: 'https://www.ups.com/track?tracknum=1Z9990W1234567890',
    shipmentDate: '2026-05-29', estimatedDelivery: '2026-06-05', actualDelivery: '2026-06-05',
    packageCount: 1, weightKg: 0.4, shippingCost: 44, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-05-29',
  },

  /* ───────── Disproquima ───────── */
  {
    id: 'shp_disproquima_1', reference: 'SHP-2026-0020', sampleRequestId: 'sr_disproquima_1', companyId: 'c_disproquima',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Jorge Ferrer',
    address: { line1: "Carrer de l'Acer", city: 'Barcelona', postalCode: '08038', country: 'Spain', countryCode: 'ES' },
    courier: 'UPS', service: 'Express Saver',
    trackingNumber: '1Z9990W2233445566', trackingUrl: 'https://www.ups.com/track?tracknum=1Z9990W2233445566',
    shipmentDate: '2026-03-28', estimatedDelivery: '2026-04-05', actualDelivery: '2026-04-05',
    packageCount: 1, weightKg: 1.2, shippingCost: 34, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-03-28',
  },
  {
    id: 'shp_disproquima_2', reference: 'SHP-2026-0021', sampleRequestId: 'sr_disproquima_2', companyId: 'c_disproquima',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Jorge Ferrer',
    address: { line1: "Carrer de l'Acer", city: 'Barcelona', postalCode: '08038', country: 'Spain', countryCode: 'ES' },
    courier: 'UPS', service: 'Express Saver',
    trackingNumber: '1Z9990W7788990011', trackingUrl: 'https://www.ups.com/track?tracknum=1Z9990W7788990011',
    shipmentDate: '2026-06-08', estimatedDelivery: '2026-06-16',
    packageCount: 1, weightKg: 2.3, shippingCost: 38, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-06-08',
  },

  /* ───────── Nutrimuscle ───────── */
  {
    id: 'shp_nutrimuscle_1', reference: 'SHP-2026-0022', sampleRequestId: 'sr_nutrimuscle_1', companyId: 'c_nutrimuscle',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Julien Moreau',
    address: { line1: 'Rue de la Science', city: 'Bruxelles', postalCode: '1040', country: 'Belgium', countryCode: 'BE' },
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146560001', trackingUrl: 'https://www.dhl.com/track?id=JD0146560001',
    shipmentDate: '2026-05-21', estimatedDelivery: '2026-05-29', actualDelivery: '2026-05-30',
    packageCount: 1, weightKg: 0.6, shippingCost: 30, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-05-21',
  },

  /* ───────── Casillo ───────── */
  {
    id: 'shp_casillo_1', reference: 'SHP-2026-0023', sampleRequestId: 'sr_casillo_2', companyId: 'c_casillo',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Antonella Greco',
    address: { line1: 'Via S. Elia ZI', city: 'Corato', region: 'BA', postalCode: '70033', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026031501', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026031501',
    shipmentDate: '2026-03-15', estimatedDelivery: '2026-03-22', actualDelivery: '2026-03-22',
    packageCount: 1, weightKg: 0.3, shippingCost: 11, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-03-15',
  },

  /* ───────── Additional historical legs to broaden the logistics board ───────── */
  {
    id: 'shp_emmi_2', reference: 'SHP-2026-0024', sampleRequestId: 'sr_emmi_1', companyId: 'c_emmi',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Jasmin Riedweg (lab annex)',
    address: { label: 'Lab annex', line1: 'Habsburgerstrasse 12', city: 'Luzern', postalCode: '6003', country: 'Switzerland', countryCode: 'CH' },
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146550009', trackingUrl: 'https://www.dhl.com/track?id=JD0146550009',
    shipmentDate: '2026-06-12', estimatedDelivery: '2026-06-19',
    packageCount: 1, weightKg: 0.2, shippingCost: 52, currency: 'EUR',
    customsStatus: 'in_clearance', incoterm: 'DAP', eoriImportInfo: 'CH import; awaiting clearance.',
    clientVisibleNotes: 'Supplementary retained sample for shelf-life panel.',
    createdAt: '2026-06-12',
  },
  {
    id: 'shp_bel_3', reference: 'SHP-2026-0025', sampleRequestId: 'sr_bel_1', companyId: 'c_bel',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Camille Rousseau (procurement)',
    address: { label: 'Procurement', line1: '16 boulevard Malesherbes', city: 'Paris', postalCode: '75008', country: 'France', countryCode: 'FR' },
    courier: 'FedEx', service: 'International Economy',
    trackingNumber: 'FX772300055', trackingUrl: 'https://www.fedex.com/track?trknbr=FX772300055',
    shipmentDate: '2026-06-11', estimatedDelivery: '2026-06-18',
    packageCount: 1, weightKg: 0.5, shippingCost: 36, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    clientVisibleNotes: 'Spec pack copy to procurement.',
    createdAt: '2026-06-11',
  },
  {
    id: 'shp_naturasi_2', reference: 'SHP-2026-0026', sampleRequestId: 'sr_naturasi_1', companyId: 'c_naturasi',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Giovanni Reghin (HQ)',
    address: { label: 'HQ', line1: 'Via Palù 23', city: 'San Vendemiano', region: 'TV', postalCode: '31020', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026060410', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026060410',
    shipmentDate: '2026-06-04', estimatedDelivery: '2026-06-12',
    packageCount: 1, weightKg: 0.2, shippingCost: 9, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    clientVisibleNotes: 'Documentation pack to private-label manager.',
    createdAt: '2026-06-04',
  },
  {
    id: 'shp_sudzucker_3', reference: 'SHP-2026-0027', sampleRequestId: 'sr_sudzucker_1', companyId: 'c_sudzucker',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Petra Hoffmann (sourcing)',
    address: { label: 'Sourcing', line1: 'Maximilianstraße 10', city: 'Mannheim', postalCode: '68165', country: 'Germany', countryCode: 'DE' },
    courier: 'DHL Express', service: 'Express Worldwide',
    trackingNumber: 'JD0146540015', trackingUrl: 'https://www.dhl.com/track?id=JD0146540015',
    shipmentDate: '2026-04-03', estimatedDelivery: '2026-04-10', actualDelivery: '2026-04-11',
    packageCount: 1, weightKg: 0.2, shippingCost: 30, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    internalNotes: 'Duplicate spec pack to sourcing; 1-day late, non-critical.',
    createdAt: '2026-04-03',
  },
  {
    id: 'shp_eurosup_3', reference: 'SHP-2026-0028', sampleRequestId: 'sr_eurosup_1', companyId: 'c_eurosup',
    senderLocation: 'Italprotein HQ, Milano (IT)', recipient: 'Roberto Galli (purchasing)',
    address: { label: 'Purchasing', line1: 'Via Galileo Galilei', city: 'Trezzano sul Naviglio', region: 'MI', postalCode: '20090', country: 'Italy', countryCode: 'IT' },
    courier: 'GLS', service: 'National Express',
    trackingNumber: 'GLSIT2026042210', trackingUrl: 'https://gls-group.com/track?match=GLSIT2026042210',
    shipmentDate: '2026-04-22', estimatedDelivery: '2026-04-28', actualDelivery: '2026-04-28',
    packageCount: 1, weightKg: 0.3, shippingCost: 10, currency: 'EUR',
    customsStatus: 'not_required', incoterm: 'DAP',
    createdAt: '2026-04-22',
  },
];

export function getShipments(): Shipment[] {
  return SHIPMENTS;
}
