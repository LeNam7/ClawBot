import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { runBash } from "../../plugins/bash.js";

const skill: Skill = {
  name: "run_bash",
  description:
    "Execute a shell command. By default, this runs securely in a Docker sandbox (node:22-alpine). " +
    "If the sandbox is not available, it FALLS BACK to executing NATIVELY on the HOST OS. " +
    "Since the host is Windows, you MUST use PowerShell commands if the execution is native.",
  input_schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to run",
      },
    },
    required: ["command"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const command = args.command ?? "";
    await ctx.sendProgress(`Đang chạy Bash: \`${command.slice(0, 80)}\``);
    return await runBash(command, deps.config.bashTimeoutMs, deps.config.workspaceDir);
  }
};

export default skill;
