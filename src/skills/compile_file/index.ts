import path from "node:path";
import fs from "node:fs";
import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { compileFile } from "../../plugins/fileio.js";

const skill: Skill = {
  name: "compile_file",
  description:
    "Biên dịch file nguồn (như .md, .csv) thành file đích như .docx, .pdf, .xlsx. " +
    "Dùng riêng trong Chunking Workflow để tổng hợp file cuối cùng giao cho user mà không vi phạm Token Limit.",
  input_schema: {
    type: "object",
    properties: {
      source_path: { type: "string", description: "File nguồn, VD: bai_luan.md" },
      target_path: { type: "string", description: "File đích, VD: bai_luan.docx" },
    },
    required: ["source_path", "target_path"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const sourcePath = args.source_path ?? "";
    const targetPath = args.target_path ?? "";
    await ctx.sendProgress(`Đang biên dịch ${sourcePath} -> ${targetPath}...`);
    
    const result = await compileFile(deps.config.workspaceDir, sourcePath, targetPath);
    
    if (result.startsWith("✅")) {
      const channel = deps.channelRegistry.get(ctx.msg.channel);
      if (channel && channel.sendFileBuffer) {
        try {
          const resolvedTarget = path.resolve(deps.config.workspaceDir, targetPath);
          const fileBuffer = fs.readFileSync(resolvedTarget);
          await channel.sendFileBuffer(ctx.msg.chatId, fileBuffer, path.basename(targetPath));
        } catch { }
      }
    }
    return result;
  }
};

export default skill;
