import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import fs from "node:fs/promises";
import path from "node:path";
import z from "zod";

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["pending", "done", "failed"]),
  next_run_time: z.string().describe("ISO datetime string for when this task should be executed next"),
  description: z.string().optional(),
});

type Task = z.infer<typeof taskSchema>;

const skill: Skill = {
  name: "manage_task_queue",
  description: 
    "PROACTIVE AGENT: Manage your persistent Task Queue. " +
    "Whenever you are awakened by a System Cron (Nhịp tim hệ thống), the CURRENT tasks list is already provided to you in the prompt! DO NOT call action='list' again! " +
    "If a task is overdue, execute the data collection/action immediately without updating status. " +
    "ONLY use action='update_status' to set it to 'done' AFTER you have fully completed it and are ready to report. " +
    "DO NOT log intermediate statuses (like 'analyzing'). It causes API Rate Limit exhaustion.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "add", "update_status", "delete"],
        description: "The action to perform on the task queue."
      },
      task_id: {
        type: "string",
        description: "Required for update_status and delete. Optional for add (auto-generated)."
      },
      title: {
        type: "string",
        description: "Required for add. Brief title of the task."
      },
      description: {
        type: "string",
        description: "Optional metadata for add."
      },
      next_run_time: {
        type: "string",
        description: "Required for add. ISO Datetime (e.g. 2024-05-10T15:00:00Z) deciding when you should act on this."
      },
      status: {
        type: "string",
        enum: ["pending", "done", "failed"],
        description: "Required for update_status."
      }
    },
    required: ["action"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const tasksFile = path.join(deps.config.workspaceDir, "tasks.json");
    
    // Ensure file exists
    try {
      await fs.access(tasksFile);
    } catch {
      await fs.mkdir(path.dirname(tasksFile), { recursive: true });
      await fs.writeFile(tasksFile, JSON.stringify([], null, 2), "utf8");
    }

    const { action, task_id, title, description, next_run_time, status } = args;
    
    let tasks: Task[] = [];
    try {
      const data = await fs.readFile(tasksFile, "utf8");
      tasks = JSON.parse(data);
    } catch (err: any) {
      return `Failed to read tasks file: ${err.message}`;
    }

    if (action === "list") {
      const pendingCount = tasks.filter(t => t.status === "pending").length;
      return `Task Queue loaded. ${tasks.length} total tasks, ${pendingCount} pending.\n\n${JSON.stringify(tasks, null, 2)}`;
    }

    if (action === "add") {
      if (!title || !next_run_time) return "Missing 'title' or 'next_run_time' for 'add' action.";
      const newTask: Task = {
        id: task_id || `task_${Date.now()}`,
        title,
        description,
        next_run_time,
        status: "pending"
      };
      tasks.push(newTask);
      await fs.writeFile(tasksFile, JSON.stringify(tasks, null, 2), "utf8");
      return `Task added successfully: ${newTask.title} (ID: ${newTask.id})`;
    }

    if (action === "update_status") {
      if (!task_id || !status) return "Missing 'task_id' or 'status' for 'update_status' action.";
      const tIdx = tasks.findIndex(t => t.id === task_id);
      if (tIdx === -1) return `Task ID not found: ${task_id}`;
      tasks[tIdx].status = status;
      await fs.writeFile(tasksFile, JSON.stringify(tasks, null, 2), "utf8");
      return `Task ${task_id} status updated to ${status}.`;
    }

    if (action === "delete") {
      if (!task_id) return "Missing 'task_id' for 'delete' action.";
      const initialLength = tasks.length;
      tasks = tasks.filter(t => t.id !== task_id);
      if (tasks.length === initialLength) return `Task ID not found: ${task_id}`;
      await fs.writeFile(tasksFile, JSON.stringify(tasks, null, 2), "utf8");
      return `Task ${task_id} deleted successfully.`;
    }

    return `Invalid action: ${action}`;
  }
};

export default skill;
