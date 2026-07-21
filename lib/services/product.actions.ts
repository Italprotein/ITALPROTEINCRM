"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireUser, requireSectionEdit } from "@/lib/backend/session";
import type { Product } from "@/lib/types";
import { productToDTO, productWriteData } from "./product.mapper";

// Product catalogue actions. The catalogue is NOT company-scoped — every user
// reads the full catalogue — so there is no scopeWhere() here.
//
// Reads are deliberately only `requireUser()`, NOT `requireSection('products')`:
// the catalogue feeds cross-page UI (product pickers, names on samples and
// projects) for roles that have the products section hidden (finance) or that
// have no such section at all (every external portal role). Gating reads on the
// section would blank product names across both workspaces.
// Writes — editing the catalogue itself — are internal staff work.

export async function listProducts(): Promise<Product[]> {
  await requireUser();
  const rows = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return rows.map(productToDTO);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  await requireUser();
  const row = await prisma.product.findUnique({ where: { id } });
  return row ? productToDTO(row) : undefined;
}

export async function createProduct(input: Product): Promise<Product> {
  const user = await requireSectionEdit("products");
  const row = await prisma.product.create({
    data: {
      ...productWriteData(input, user.id),
      id: input.id,
      createdById: user.id,
    },
  });
  return productToDTO(row);
}

export async function updateProduct(
  id: string,
  patch: Partial<Product>,
): Promise<Product | undefined> {
  const user = await requireSectionEdit("products");
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: Product = { ...productToDTO(existing), ...patch };
  const row = await prisma.product.update({
    where: { id },
    data: productWriteData(merged, user.id),
  });
  return productToDTO(row);
}

export async function removeProduct(id: string): Promise<void> {
  await requireSectionEdit("products");
  await prisma.product.delete({ where: { id } }).catch(() => undefined);
}

export async function productsByCompany(companyId: string): Promise<Product[]> {
  await requireUser();
  const rows = await prisma.product.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });
  return rows.map(productToDTO);
}

export async function productStatistics() {
  await requireUser();
  const rows = await prisma.product.findMany({ select: { status: true } });
  return {
    total: rows.length,
    launched: rows.filter((r) => r.status === "launched").length,
    inDevelopment: rows.filter((r) => r.status === "in_development").length,
  };
}
