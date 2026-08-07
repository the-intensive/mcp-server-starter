import { z } from 'zod';
import { defineTool, json, toolError, type Tool } from './registry';
import { SCOPES } from './scopes';

/**
 * ===========================================================================
 * THIS IS THE FILE YOU EDIT.
 * ===========================================================================
 *
 * Everything else in this repo is plumbing you can mostly leave alone. Your
 * job is to replace the example tools below with ones that map to your app.
 *
 * Design notes worth reading once (full version in docs/TOOL-DESIGN.md):
 *
 *  - One tool per user intent, not one per database table. `list_projects` is
 *    a tool. `query_table` is not.
 *  - Return the smallest useful payload. Everything a tool returns is spent
 *    from the model's context window; dumping full records crowds out the
 *    conversation and makes answers worse.
 *  - Put anything with a side effect behind SCOPES.WRITE and set
 *    `destructiveHint` honestly. Clients surface those hints to users.
 *  - Errors should tell the model how to recover, not just that it failed.
 */

const listProjects = defineTool<{ includeArchived?: boolean }>({
  name: 'list_projects',
  description:
    'List the projects the current user can access. Returns id, name, and status for each. ' +
    'Call this first when the user refers to a project by name -- you need the id for other tools.',
  inputSchema: {
    includeArchived: z
      .boolean()
      .optional()
      .describe('Include archived projects. Defaults to false.'),
  },
  requiredScopes: [SCOPES.READ],
  annotations: {
    title: 'List Projects',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async handler(args, ctx) {
    const projects = await ctx.services.listProjects({
      includeArchived: args.includeArchived ?? false,
    });

    // Return a trimmed projection rather than the raw record. The full object
    // may carry internal fields the model has no use for and the user should
    // not see.
    return json(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        updatedAt: p.updatedAt,
      })),
    );
  },
});

const getProjectTasks = defineTool<{ projectId: string }>({
  name: 'get_project_tasks',
  description:
    'Get the tasks belonging to one project. Requires a project id -- use list_projects to resolve a name to an id first.',
  inputSchema: {
    projectId: z.string().describe('The project id, e.g. "proj_001".'),
  },
  requiredScopes: [SCOPES.READ],
  annotations: {
    title: 'Get Project Tasks',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async handler(args, ctx) {
    const project = await ctx.services.getProject(args.projectId);

    if (!project) {
      // Actionable: tells the model exactly how to fix its own mistake.
      return toolError(
        `No project found with id "${args.projectId}". Call list_projects to see valid ids.`,
      );
    }

    const tasks = await ctx.services.listTasks(project.id);
    return json({ project: { id: project.id, name: project.name }, tasks });
  },
});

const createTask = defineTool<{ projectId: string; title: string }>({
  name: 'create_task',
  description:
    'Create a new task in a project. This writes to the user\'s account -- only call it when the user has clearly asked for a task to be created.',
  inputSchema: {
    projectId: z.string().describe('The project id to create the task in.'),
    title: z.string().min(1).max(200).describe('Short title for the task.'),
  },
  requiredScopes: [SCOPES.WRITE],
  annotations: {
    title: 'Create Task',
    readOnlyHint: false,
    // Creating is not destructive -- it does not overwrite or remove anything.
    // Reserve destructiveHint for updates and deletes; clients use it to decide
    // how hard to confirm with the user, so inflating it trains people to click
    // through warnings.
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  async handler(args, ctx) {
    const project = await ctx.services.getProject(args.projectId);

    if (!project) {
      return toolError(
        `No project found with id "${args.projectId}". Call list_projects to see valid ids.`,
      );
    }

    const task = await ctx.services.createTask({
      projectId: project.id,
      title: args.title,
    });

    return json({ created: task });
  },
});

/**
 * The registry. Add your tools here.
 *
 * The `as unknown as Tool<never>[]` cast exists because each tool has a
 * different args type and TypeScript has no way to express a heterogeneous list
 * of them. Type safety is preserved where it counts -- inside each handler,
 * via defineTool's inference.
 */
export const TOOLS = [listProjects, getProjectTasks, createTask] as unknown as Tool<never>[];
