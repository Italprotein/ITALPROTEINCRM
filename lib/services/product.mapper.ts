import { Prisma } from "@/lib/generated/prisma/client";
import type { Product as PrismaProduct } from "@/lib/generated/prisma/client";
import type { Product } from "@/lib/types";

// Prisma row <-> Product DTO. Product is the catalogue and is NOT company-scoped
// (everyone reads it). The Prisma model carries extra catalogue columns (sku,
// format, segment, attributes, specs, indicativePriceMinor, currency) that the
// DTO does not expose; the write helper leaves them untouched so updates never
// clobber them.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

/** Prisma row -> Product DTO (the shape the UI consumes). */
export function productToDTO(p: PrismaProduct): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    companyId: undef(p.companyId),
    brandName: undef(p.brandName),
    market: undef(p.market),
    proaminaDosage: undef(p.proaminaDosage),
    status: p.status,
    description: undef(p.description),
    imageUrl: undef(p.imageUrl),
    relatedProjectId: undef(p.relatedProjectId),
    createdAt: p.createdAt.toISOString(),
  };
}

/** Product DTO -> Prisma write payload (shared by create and update). Catalogue
 *  columns not present on the DTO are intentionally omitted. */
export function productWriteData(input: Product, actorId: string | null) {
  return {
    name: input.name,
    category: input.category,
    companyId: input.companyId ?? null,
    brandName: input.brandName ?? null,
    market: input.market ?? null,
    proaminaDosage: input.proaminaDosage ?? null,
    status: input.status,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    relatedProjectId: input.relatedProjectId ?? null,
    updatedById: actorId,
  } satisfies Prisma.ProductUncheckedUpdateInput;
}
