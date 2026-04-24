import fs from "node:fs/promises";
import path from "node:path";
import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";

const skill: Skill = {
  name: "request_peer_review",
  description:
    "Gọi thêm một vòng đời AI siêu cấp thứ 2 đóng vai 'Kiểm toán viên Red-Team khó tính' để quét qua code bạn sửa. BẮT BUỘC gọi hàm này với các file quan trọng vừa Code xong trước khi kết luận cho Sếp. Lỗi Logic ngầm, Memory leak hoặc bảo mật hổng sẽ bị mắng té tát ở đây.",
  input_schema: {
    type: "object",
    properties: {
      files_to_review: {
        type: "array",
        items: { type: "string" },
        description: "Danh sách đường dẫn các file bạn vừa chỉnh sửa. (vd: ['src/ai/verifier.ts', 'src/core/prompt.ts'])",
      },
      task_goal: {
        type: "string",
        description: "Mô tả siêu ngắn: Mục tiêu bạn được giao là gì để Reviewer còn biết lối chấm điểm."
      }
    },
    required: ["files_to_review", "task_goal"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const files = args.files_to_review as string[];
    const goal = args.task_goal as string;
    
    if (!files || files.length === 0) return "❌ Lỗi: Bạn chưa đưa file nào cho Reviewer soi.";
    
    await ctx.sendProgress(`🕵️ [Peer Review] Đánh thức AI thứ 2 để soi lỗi lén lút trong logic...`);
    
    let combinedContent = `MỤC TIÊU CỐT LÕI CỦA CODER: ${goal}\n\nMÃ NGUỒN HIỆN TẠI:\n`;
    for (const file of files) {
      try {
         const p = path.resolve(deps.config.workspaceDir, file);
         const c = await fs.readFile(p, "utf-8");
         combinedContent += `--- BẮT ĐẦU FILE: ${file} ---\n\`\`\`\n${c}\n\`\`\`\n--- KẾT THÚC FILE: ${file} ---\n\n`;
      } catch (e: any) {
         combinedContent += `[Không thể đọc file ${file} do lỗi: ${e.message}]\n`;
      }
    }

    const reviewerPrompt = `Bạn là Trưởng Nhom Kỹ Thuật Siêu Khó Tính (Red-Teamer/Auditor AI). 
Một tên Coder cấp dưới vừa nộp đoạn Code dưới đây. Terminal Compiler báo là File XANH MƯỢT (không có cú pháp gì sai), nên bạn BỎ QUA kiểm tra Syntax đơn thuần!

Vai trò của bạn: 
- Nhanh chóng săm soi TÍNH LOGIC: Code có xài Ngu ngốc không? Có dính Infinity Loop không? Vòng lặp For quá cồng kềnh? Quên dọn dẹp (memory leak)? Edge cases chưa chặn?
- Chỉ ra các lỗ hổng siêu ngầm, lỗ hổng Business Logic liên đới.

**QUY TẮC CỨNG:**
1. CẤM KHEN. Nếu Code nộp vào đã tốt, trả lời ngắn gọn đúng 1 câu cộc lốc duy nhất: "PASS PEER REVIEW".
2. Nếu có lỗi, CHỬI CỰC GẮT. Liệt kê lỗi dưới dạng Bullet Points kèm hướng giải quyết, bắt Coder phải sửa. Tối đa 200 chữ. Cấm nói vòng vo!`;

    try {
      let responseText = "";
      const stream = deps.aiClient.stream({
        history: [],
        userMessage: combinedContent,
        model: deps.config.model, // Clone lại model cấu hình hiện tại để đánh giá chéo
        maxTokens: 500, // Review ngắn gọn
        systemPrompt: reviewerPrompt
      });

      for await (const chunk of stream) {
        if (chunk.type === "delta" && chunk.delta) responseText += chunk.delta;
      }

      const review = responseText.trim();
      if (review.toUpperCase().includes("PASS PEER REVIEW")) {
        await ctx.sendProgress(`✅ [Peer Review] Trưởng nhóm gật đầu. Code hoàn mỹ rớt hột!`);
        return `[TỪ TRƯỞNG NHÓM REVIEWER]: CODE ĐÃ ĐƯỢC DUYỆT. Báo Xong cho Sếp!`;
      } else {
        await ctx.sendProgress(`☠️ [Peer Review] Bị chửi té tát! Yêu cầu tự động gọi Tool sửa lỗi.`);
        return `[TỪ TRƯỞNG NHÓM REVIEWER - RED TEAM ALERT 🔥]\n\n${review}\n\n-> Lệnh Bắt Buộc Dành Cho Bạn: Mau đọc bãi chửi trên, bấm gọi Tool replace_in_file ngay lập tức để vá các lỗ hổng rò rỉ logic. SAU ĐÓ GỌI RE-REVIEW! Cấm cãi!`;
      }
    } catch(e: any) {
      return `⚠️ Kết nối tới nhánh Reviewer bị chập chờn: ${e.message}. Bỏ qua cữ đánh giá chéo này.`;
    }
  }
};

export default skill;
