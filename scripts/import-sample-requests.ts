import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SOURCE_NOTE =
  "Imported from “Lista spedizioni campioni Proamina®.docx” on 2026-07-31. " +
  "The source lists delivery details but no request date.";

const requests = [
  {
    reference: "SR-GALBUSERA-LISTA-20260731",
    companyName: "Galbusera",
    contactEmail: "andrea.villa@galbusera.it",
    recipient: "Andrea Villa",
    recipientPhone: null,
    recipientEmail: "andrea.villa@galbusera.it",
    address: {
      company: "Galbusera S.p.A.",
      line1: "Viale Orobie 9",
      postalCode: "23013",
      city: "Cosio Valtellino",
      region: "SO",
      country: "Italy",
    },
  },
  {
    reference: "SR-WARBURTONS-LISTA-20260731",
    companyName: "Warburtons",
    contactEmail: "michael.hamer@warburtons.co.uk",
    recipient: "Michael Hamer",
    recipientPhone: "+44 7976 609602",
    recipientEmail: "michael.hamer@warburtons.co.uk",
    address: {
      attention: "Michael Hamer",
      company: "Warburtons Limited",
      line1: "Hereford Street",
      postalCode: "BL1 8HJ",
      city: "Bolton",
      country: "UK",
    },
  },
] as const;

async function main() {
  for (const input of requests) {
    const company = await prisma.company.findFirst({
      where: { legalName: { equals: input.companyName, mode: "insensitive" } },
      select: { id: true, legalName: true },
    });
    if (!company) throw new Error(`Company not found: ${input.companyName}`);

    const contact = await prisma.contact.findFirst({
      where: { companyId: company.id, email: { equals: input.contactEmail, mode: "insensitive" } },
      select: { id: true },
    });
    if (!contact) throw new Error(`Contact not found: ${input.contactEmail}`);

    await prisma.sampleRequest.upsert({
      where: { reference: input.reference },
      create: {
        reference: input.reference,
        companyId: company.id,
        contactId: contact.id,
        applicationCategory: "bakery",
        requestedProduct: "Proamina®",
        requestedQuantity: 1,
        unit: "kg",
        requestDate: new Date("2026-07-31T00:00:00.000Z"),
        priority: "medium",
        requiredDocuments: [],
        deliveryAddress: input.address,
        recipient: input.recipient,
        recipientPhone: input.recipientPhone,
        recipientEmail: input.recipientEmail,
        status: "submitted",
        internalInstructions: SOURCE_NOTE,
      },
      update: {
        companyId: company.id,
        contactId: contact.id,
        applicationCategory: "bakery",
        requestedProduct: "Proamina®",
        requestedQuantity: 1,
        unit: "kg",
        priority: "medium",
        deliveryAddress: input.address,
        recipient: input.recipient,
        recipientPhone: input.recipientPhone,
        recipientEmail: input.recipientEmail,
        internalInstructions: SOURCE_NOTE,
      },
    });
    console.log(`Upserted ${input.reference} for ${company.legalName}`);
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
