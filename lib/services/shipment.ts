import type { Shipment } from "@/lib/types";
import {
  deriveShipmentStatus,
  type ShipmentService,
} from "@/lib/mock-services/shipmentService";
import {
  listShipments,
  getShipment,
  createShipment,
  updateShipment,
  removeShipment,
  shipmentsByCompany,
  shipmentsBySample,
  shipmentStatistics,
} from "./shipment.actions";

// Real (Prisma-backed) shipmentService — contract-identical to the mock service.
// deriveStatus reuses the shared pure helper; _now is live in api mode.
export const shipmentService: ShipmentService = {
  list: () => listShipments(),
  get: (id: string) => getShipment(id),
  getById: (id: string) => getShipment(id),
  create: (s: Shipment) => createShipment(s),
  update: (id: string, patch: Partial<Shipment>) => updateShipment(id, patch),
  remove: (id: string) => removeShipment(id),
  reset: () => {},

  deriveStatus: deriveShipmentStatus,

  byCompany: (companyId: string) => shipmentsByCompany(companyId),
  bySample: (sampleRequestId: string) => shipmentsBySample(sampleRequestId),
  getStatistics: () => shipmentStatistics(),
  get _now() {
    return new Date();
  },
};
