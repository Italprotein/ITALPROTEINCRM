import type { SampleService } from "@/lib/mock-services/sampleService";
import {
  listSamples,
  getSample,
  createSample,
  updateSample,
  removeSample,
  samplesByCompany,
  samplesByStatus,
  sampleStatistics,
} from "./sample.actions";

// Real (Prisma-backed) sampleService — contract-identical to the mock service.
export const sampleService: SampleService = {
  list: () => listSamples(),
  get: (id: string) => getSample(id),
  getById: (id: string) => getSample(id),
  create: (s) => createSample(s),
  update: (id: string, patch) => updateSample(id, patch),
  remove: (id: string) => removeSample(id),
  reset: () => {},
  byCompany: (companyId: string) => samplesByCompany(companyId),
  byStatus: (status) => samplesByStatus(status),
  getStatistics: () => sampleStatistics(),
};
