import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";
import { appendToFile } from "../plugins/fileio.js";

const skill: Skill = {
  name: "append_to_file",
  description:
    "Nối thêm nội dung vào cuối tệp tin văn bản (text/markdown/code). Dùng riêng cho Chunking Workflow để viết các văn bản khổng lồ.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Đường dẫn file (VD: nhap.md)" },
      content: { type: "string", description: "Nội dung cần nối thêm" },
    },
    required: ["path", "content"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const filePath = args.path ?? "";
    const content = args.content ?? "";
    await ctx.sendProgress(`Đang viết tiếp vào file: ${filePath}`);
    return appendToFile(deps.config.workspaceDir, filePath, content);
  }
};

export default skill;
