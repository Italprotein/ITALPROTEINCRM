import type { ApplicationProject } from "@/lib/types";
import type { ProjectService } from "@/lib/mock-services/projectService";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  removeProject,
  projectsByCompany,
  projectStatistics,
} from "./project.actions";

// Real (Prisma-backed) projectService — contract-identical to the mock service.
export const projectService: ProjectService = {
  list: () => listProjects(),
  get: (id: string) => getProject(id),
  getById: (id: string) => getProject(id),
  create: (p: ApplicationProject) => createProject(p),
  update: (id: string, patch: Partial<ApplicationProject>) => updateProject(id, patch),
  remove: (id: string) => removeProject(id),
  reset: () => {},
  byCompany: (companyId: string) => projectsByCompany(companyId),
  getStatistics: () => projectStatistics(),
};
