import fs from "node:fs/promises";
import path from "node:path";
import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";

const skill: Skill = {
  name: "read_symbol",
  description:
    "Đọc phần nội dung chi tiết xung quanh một Function, Class hoặc Biến (Đọc Đục Lỗ). Giới hạn nội dung hiển thị trong khoảng 100-150 dòng quanh symbol để tiết kiệm MỨC TIÊU THỤ RAM/CONTEXT. Khuyến nghị BẮT BUỘC dùng tool này thay cho read_file khi code base quá lớn.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Đường dẫn file (ví dụ: src/utils.ts)" },
      symbol: { type: "string", description: "Tên chính xác của hàm, class, const, let cần đọc (ví dụ: CodeVerifier, fetchUser, initDB)" }
    },
    required: ["path", "symbol"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const filePath = args.path ?? "";
    const symbol = args.symbol ?? "";
    
    await ctx.sendProgress(`🔍 Đang dùng Dao Mổ (Surgical Reader) lọc ruột [${symbol}] trong file ${filePath}...`);
    const fullPath = path.resolve(deps.config.workspaceDir, filePath);
    
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const lines = content.split('\n');
      
      let targetLineIdx = -1;
      // Regex dò tìm khai báo thay vì gọi (ví dụ ưu tiên "function foo" hoặc "class foo" thay vì "foo()")
      const declarationRegex = new RegExp(`(?:function|class|const|let|var|interface|type)\\s+${symbol}\\b`);
      for (let i = 0; i < lines.length; i++) {
         if (declarationRegex.test(lines[i])) {
             targetLineIdx = i;
             break;
         }
      }
      
      // Fallback: nếu không thấy chỗ khai báo, tìm đại từ khoá xuất hiện đầu tiên (có thể là lệnh gọi func)
      if (targetLineIdx === -1) {
          const looseRegex = new RegExp(`\\b${symbol}\\b`);
          for (let i = 0; i < lines.length; i++) {
             if (looseRegex.test(lines[i])) {
                 targetLineIdx = i;
                 break;
             }
          }
      }
      
      if (targetLineIdx === -1) {
         return `❌ [Read Symbol Error] Không tìm thấy bất kỳ dấu vết nào của '${symbol}' trong file ${filePath}. Bạn có gõ sai tên không?`;
      }
      
      // Lấy 15 dòng trước (để lấy comment JSDoc/imports) và 150 dòng sau để gom trọn thân hàm
      const startIdx = Math.max(0, targetLineIdx - 15);
      const endIdx = Math.min(lines.length - 1, targetLineIdx + 150);
      
      let chunk = "";
      for (let i = startIdx; i <= endIdx; i++) {
         chunk += `${i + 1}: ${lines[i]}\n`;
      }
      
      return `[TRÍCH XUẤT ĐỤC LỖ - SYMBOL: ${symbol}]\nĐã cắt tách ruột code từ dòng ${startIdx + 1} đến ${endIdx + 1} của file ${filePath}:\n\n\`\`\`\n${chunk}\n\`\`\`\n\n(Nếu hàm này siêu dài vượt 150 dòng, phần đuôi đã bị cắt ẩn để chống nghẽn Context. Nếu cần sửa, hãy dùng thay thế regex điểm (replace_in_file) trên các dòng bạn nhìn thấy!)`;
    } catch(e: any) {
      return `❌ Lỗi đọc file: ${e.message}`;
    }
  }
};

export default skill;
