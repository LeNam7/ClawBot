import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { readFile } from "../../plugins/fileio.js";

const skill: Skill = {
  name: "read_file",
  description:
    "Đọc nội dung file trong workspace. Dùng khi cần xem code hiện tại, đọc config, hoặc review file.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Đường dẫn file tương đối trong workspace, ví dụ: 'src/index.ts', 'README.md'",
      },
    },
    required: ["path"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    await ctx.sendProgress(`Đang đọc file: ${args.path ?? ""}`);
    return readFile(deps.config.workspaceDir, args.path ?? "");
  }
};

export default skill;
