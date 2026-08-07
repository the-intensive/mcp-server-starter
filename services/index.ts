/**
 * YOUR APP'S SERVICE LAYER -- replace all of this.
 *
 * This is a stub so the starter runs before you have wired anything up. Every
 * function returns fake in-memory data.
 *
 * When you replace it, the one rule that matters: these functions must go
 * through the same authorization your app already enforces. Call the service
 * objects, repository classes, or internal API your web app calls. Do NOT open
 * a fresh database connection here and query freely -- that is how an MCP
 * server ends up able to read rows the logged-in user could never see in the
 * product. See docs/TOOL-DESIGN.md.
 *
 * Note `createServices` takes the caller's identity and closes over it, so an
 * individual method cannot forget to scope itself.
 */

export type Project = {
  id: string;
  name: string;
  status: 'active' | 'archived';
  updatedAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  done: boolean;
};

export type Services = {
  listProjects(opts: { includeArchived: boolean }): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  listTasks(projectId: string): Promise<Task[]>;
  createTask(input: { projectId: string; title: string }): Promise<Task>;
};

type Caller = { userId: string; orgId: string | null };

const FAKE_PROJECTS: Project[] = [
  { id: 'proj_001', name: 'Website redesign', status: 'active', updatedAt: '2026-08-01T10:00:00Z' },
  { id: 'proj_002', name: 'Q3 migration', status: 'active', updatedAt: '2026-07-22T16:30:00Z' },
  { id: 'proj_003', name: 'Old intranet', status: 'archived', updatedAt: '2026-02-11T09:15:00Z' },
];

const FAKE_TASKS: Task[] = [
  { id: 'task_001', projectId: 'proj_001', title: 'Audit current IA', done: true },
  { id: 'task_002', projectId: 'proj_001', title: 'Draft new nav', done: false },
  { id: 'task_003', projectId: 'proj_002', title: 'Inventory mailboxes', done: false },
];

export function createServices(caller: Caller): Services {
  // `caller` is unused in the stub, but every real implementation should thread
  // it into whatever authorization your app performs.
  void caller;

  return {
    async listProjects({ includeArchived }) {
      return FAKE_PROJECTS.filter((p) => includeArchived || p.status === 'active');
    },

    async getProject(id) {
      return FAKE_PROJECTS.find((p) => p.id === id) ?? null;
    },

    async listTasks(projectId) {
      return FAKE_TASKS.filter((t) => t.projectId === projectId);
    },

    async createTask({ projectId, title }) {
      const task: Task = {
        id: `task_${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        title,
        done: false,
      };
      FAKE_TASKS.push(task);
      return task;
    },
  };
}
