function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'ad@italprotein.com';
const primaryPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE_PRIMARY ?? '+39 351 910 3211';

export const siteContact = {
  companyName: 'Italprotein Srl',
  website: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.italprotein.com',
  email: contactEmail,
  emailHref: `mailto:${contactEmail}`,
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS ?? 'Galleria Cavour 7, Bologna, Italy',
  phones: [
    {
      id: 'primary',
      label: 'Bologna',
      display: primaryPhone,
      href: phoneHref(primaryPhone),
    },
  ],
} as const;
