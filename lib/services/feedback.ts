import type { Feedback } from "@/lib/types";
import type { FeedbackService } from "@/lib/mock-services/feedbackService";
import {
  listFeedback,
  getFeedback,
  createFeedback,
  updateFeedback,
  removeFeedback,
  feedbackByCompany,
  feedbackBySample,
  feedbackStatistics,
} from "./feedback.actions";

// Real (Prisma-backed) feedbackService — contract-identical to the mock service.
export const feedbackService: FeedbackService = {
  list: () => listFeedback(),
  get: (id: string) => getFeedback(id),
  getById: (id: string) => getFeedback(id),
  create: (f: Feedback) => createFeedback(f),
  update: (id: string, patch: Partial<Feedback>) => updateFeedback(id, patch),
  remove: (id: string) => removeFeedback(id),
  reset: () => {},
  byCompany: (companyId: string) => feedbackByCompany(companyId),
  bySample: (sampleRequestId: string) => feedbackBySample(sampleRequestId),
  getStatistics: () => feedbackStatistics(),
};
