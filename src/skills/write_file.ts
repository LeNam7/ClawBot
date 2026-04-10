import fs from "node:fs";
import path from "node:path";
import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";
import { writeFile } from "../plugins/fileio.js";
import { CodeVerifier } from "../ai/verifier.js";

const skill: Skill = {
  name: "write_file",
  description:
    "Ghi nội dung vào file trong workspace. Tự động chọn định dạng theo đuôi file: " +
    ".docx (Word) — content là text/markdown với heading #/##/###; " +
    ".xlsx (Excel) — content là CSV hoặc JSON array; " +
    ".pdf (PDF) — content là text/markdown với heading #/##/###; " +
    "các đuôi khác (.ts, .py, .json, .txt, .md, v.v.) — ghi text thuần. " +
    "Dùng khi tạo document, project, code, config, README, v.v.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Đường dẫn file tương đối trong workspace, ví dụ: 'report.docx', 'data.xlsx', 'src/index.ts'",
      },
      content: {
        type: "string",
        description: "Nội dung file. Với .docx/.pdf dùng markdown (#, ##, ###). Với .xlsx dùng CSV hoặc JSON array.",
      },
    },
    required: ["path", "content"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const filePath = args.path ?? "";
    await ctx.sendProgress(`Đang tạo file: ${filePath}`);
    const result = await writeFile(deps.config.workspaceDir, filePath, args.content ?? "");
    
    if (result.startsWith("✅")) {
      const channel = deps.channelRegistry.get(ctx.msg.channel);
      if (channel && channel.sendFileBuffer) {
        try {
          const resolvedPath = path.resolve(deps.config.workspaceDir, filePath);
          const fileBuffer = fs.readFileSync(resolvedPath);
          await channel.sendFileBuffer(ctx.msg.chatId, fileBuffer, path.basename(filePath));
        } catch { }
      }
      
      const ext = path.extname(filePath).toLowerCase();
      const isCodeFile = [".ts", ".js", ".py", ".go", ".java", ".cpp", ".c", ".rs", ".php", ".sh"].includes(ext);
      
      if (isCodeFile) {
        try {
           const verifier = new CodeVerifier(deps.aiClient, deps.config, ctx.sendProgress);
           const fullPath = path.resolve(deps.config.workspaceDir, filePath);
           const content = fs.readFileSync(fullPath, "utf-8");
           const vResult = await verifier.verifyFile(filePath, content);
           if (!vResult.isOk) {
             return `Lệnh GHI FILE MÃ NGUỒN đã thành công, NHƯNG HỆ THỐNG TRỌNG TÀI BÁO LỖI. \nLỗi: ${vResult.error}\n\n-> YÊU CẦU AGENT TỰ ĐỘNG PHÂN TÍCH LẠI LỖI VÀ GỌI LỆNH SỬA CHỮA NGAY LẬP TỨC!`;
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
