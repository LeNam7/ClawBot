import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { listDir } from "../../plugins/fileio.js";

const skill: Skill = {
  name: "list_dir",
  description: "Liệt kê nội dung thư mục trong workspace. Dùng để xem cấu trúc project.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Đường dẫn thư mục tương đối, mặc định là '.' (root workspace)",
      },
    },
    required: [],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    await ctx.sendProgress(`Đang xem thư mục: ${args.path ?? "."}`);
    return listDir(deps.config.workspaceDir, args.path ?? ".");
  }
};

export default skill;
