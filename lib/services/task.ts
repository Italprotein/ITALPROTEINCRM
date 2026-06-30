import type { Task } from "@/lib/types";
import type { TaskService } from "@/lib/mock-services/taskService";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  removeTask,
  tasksByOwner,
  tasksByCompany,
  tasksOverdue,
  tasksDueToday,
  tasksUpcoming,
  taskStatistics,
} from "./task.actions";

// Real (Prisma-backed) taskService — contract-identical to the mock service, so
// the UI is untouched; the barrel swaps this in when NEXT_PUBLIC_DATA_MODE=api.
export const taskService: TaskService = {
  list: () => listTasks(),
  get: (id: string) => getTask(id),
  getById: (id: string) => getTask(id),
  create: (t: Task) => createTask(t),
  update: (id: string, patch: Partial<Task>) => updateTask(id, patch),
  remove: (id: string) => removeTask(id),
  reset: () => {},
  byOwner: (ownerId: string) => tasksByOwner(ownerId),
  byCompany: (companyId: string) => tasksByCompany(companyId),
  overdue: (now?: Date) => tasksOverdue(now),
  dueToday: (now?: Date) => tasksDueToday(now),
  upcoming: (now?: Date) => tasksUpcoming(now),
  getStatistics: (now?: Date) => taskStatistics(now),
};
