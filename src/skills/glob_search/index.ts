import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { executeGlob } from "../../plugins/search.js";

const skill: Skill = {
  name: "glob_search",
  description:
    "Liệt kê tất cả các file khớp với mẫu (wildcard pattern) trong thư mục gốc. " +
    "Dùng khi bạn muốn lấy danh sách tất cả các file có đuôi nhất định, ví dụ: 'src/**/*.ts' để lấy hết code TS.",
  input_schema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Mẫu tìm kiếm (Glob pattern), ví dụ: 'src/**/*.ts', '*.md'",
      },
    },
    required: ["pattern"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    return await executeGlob(deps.config.workspaceDir, args.pattern as string);
  }
};

export default skill;
