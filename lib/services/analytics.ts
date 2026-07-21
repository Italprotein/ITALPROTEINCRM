import type { AnalyticsService } from "@/lib/mock-services/analyticsService";
import {
  companiesOverTime,
  companiesByCountry,
  companiesByCategory,
  pipelineDistribution,
  ndaFunnel,
  sampleFunnel,
  samplesOverTime,
  ndaCompletionTrend,
  shipmentStatusBreakdown,
  shipmentPerformance,
  avgFirstContactToNda,
  avgNdaToShipment,
  teamActivity,
  taskCompletionRate,
  topMarkets,
  topApplications,
  feedbackResults,
} from "./analytics.actions";

// Real (Prisma-backed) analyticsService — contract-identical to the mock service.
// Cross-module read-only aggregator; every method delegates to a server action.
// `_now` is the real clock (the mock keeps its own demo anchor).
export const analyticsService: AnalyticsService = {
  companiesOverTime: () => companiesOverTime(),
  companiesByCountry: () => companiesByCountry(),
  companiesByCategory: () => companiesByCategory(),
  pipelineDistribution: () => pipelineDistribution(),
  ndaFunnel: () => ndaFunnel(),
  sampleFunnel: () => sampleFunnel(),
  samplesOverTime: () => samplesOverTime(),
  ndaCompletionTrend: () => ndaCompletionTrend(),
  shipmentStatusBreakdown: () => shipmentStatusBreakdown(),
  shipmentPerformance: () => shipmentPerformance(),
  avgFirstContactToNda: () => avgFirstContactToNda(),
  avgNdaToShipment: () => avgNdaToShipment(),
  teamActivity: () => teamActivity(),
  taskCompletionRate: () => taskCompletionRate(),
  topMarkets: () => topMarkets(),
  topApplications: () => topApplications(),
  feedbackResults: () => feedbackResults(),
  _now: new Date(),
};
