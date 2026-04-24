import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { executeGrep } from "../../plugins/search.js";

const skill: Skill = {
  name: "grep_search",
  description:
    "Sử dụng công cụ RipGrep Native để tìm kiếm text chính xác hoặc RegEx trong hàng loạt các file với tốc độ siêu nhanh. " +
    "Sử dụng công cụ này thay vì dùng run_bash với grep nếu bạn muốn rà soát code trên hệ thống.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Từ khóa hoặc đoạn text cần tìm (Regex cũng được).",
      },
      dir: {
        type: "string",
        description: "Thư mục để khoanh vùng quét (Tương đối so với workspace), ví dụ: 'src'. Mặc định quét tất cả '.'",
      },
    },
    required: ["query"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    return await executeGrep(deps.config.workspaceDir, args.query as string, args.dir || ".");
  }
};

export default skill;
