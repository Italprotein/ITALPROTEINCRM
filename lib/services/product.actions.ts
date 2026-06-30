"use server";

import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import type { Product } from "@/lib/types";
import { productToDTO, productWriteData } from "./product.mapper";

// Product catalogue actions. The catalogue is NOT company-scoped — every user
// reads the full catalogue — so there is no scopeWhere() here.

export async function listProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return rows.map(productToDTO);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const row = await prisma.product.findUnique({ where: { id } });
  return row ? productToDTO(row) : undefined;
}

export async function createProduct(input: Product): Promise<Product> {
  const user = await getCurrentUser();
  const row = await prisma.product.create({
    data: {
      ...productWriteData(input, user?.id ?? null),
      id: input.id,
      createdById: user?.id ?? null,
    },
  });
  return productToDTO(row);
}

export async function updateProduct(
  id: string,
  patch: Partial<Product>,
): Promise<Product | undefined> {
  const user = await getCurrentUser();
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: Product = { ...productToDTO(existing), ...patch };
  const row = await prisma.product.update({
    where: { id },
    data: productWriteData(merged, user?.id ?? null),
  });
  return productToDTO(row);
}

export async function removeProduct(id: string): Promise<void> {
  await prisma.product.delete({ where: { id } }).catch(() => undefined);
}

export async function productsByCompany(companyId: string): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });
  return rows.map(productToDTO);
}

export async function productStatistics() {
  const rows = await prisma.product.findMany({ select: { status: true } });
  return {
    total: rows.length,
    launched: rows.filter((r) => r.status === "launched").length,
    inDevelopment: rows.filter((r) => r.status === "in_development").length,
  };
}
