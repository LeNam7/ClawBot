import fs from "node:fs";
import path from "node:path";
import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";
import { replaceInFile } from "../plugins/fileio.js";
import { CodeVerifier } from "../ai/verifier.js";

const skill: Skill = {
  name: "replace_in_file",
  description:
    "Sửa điểm (Surgical edit) nội dung trên một file bằng cách tìm `target_content` và thay bằng `replacement_content`.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string" },
      target_content: { type: "string" },
      replacement_content: { type: "string" },
    },
    required: ["path", "target_content", "replacement_content"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const filePath = args.path ?? "";
    const target = args.target_content ?? "";
    const replacement = args.replacement_content ?? "";
    
    await ctx.sendProgress(`Đang sửa đổi file: ${filePath}`);
    const result = await replaceInFile(deps.config.workspaceDir, filePath, target, replacement);
    
    if (result.startsWith("✅")) {
      const ext = path.extname(filePath).toLowerCase();
      const isCodeFile = [".ts", ".js", ".py", ".go", ".java", ".cpp", ".c", ".rs", ".php", ".sh"].includes(ext);
      
      if (isCodeFile) {
        try {
           const verifier = new CodeVerifier(deps.aiClient, deps.config, ctx.sendProgress);
           const fullPath = path.resolve(deps.config.workspaceDir, filePath);
           const content = fs.readFileSync(fullPath, "utf-8");
           const vResult = await verifier.verifyFile(filePath, content);
           if (!vResult.isOk) {
             return `Lệnh SỬA FILE đã thành công, NHƯNG HỆ THỐNG TRỌNG TÀI BÁO LỖI. \nLỗi: ${vResult.error}\n\n-> YÊU CẦU AGENT TỰ ĐỘNG PHÂN TÍCH LẠI LỖI VÀ GỌI LỆNH SỬA CHỮA NGAY LẬP TỨC!`;
           }
        } catch (e) {
           console.error("[Verifier Error]", e);
        }
      }
    }
    return result;
  }
};

export default skill;
