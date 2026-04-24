import { spawn } from "node:child_process";
import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";

const skill: Skill = {
  name: "trigger_antigravity",
  description: "Cầu nối cấp cao: Ủy quyền (delegate) một task siêu phức tạp hoặc công việc viết Code/Refactor dự án cho siêu AI nội trú Antigravity (IDE Agent) thực thi.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Lời yêu cầu (Prompt) cực kỳ chi tiết gửi đến Antigravity. Bao gồm mô tả lõi vấn đề, file nào cần sửa, và yêu cầu Output rõ ràng.",
      },
    },
    required: ["prompt"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const prompt = args.prompt;
    if (!prompt) return "Lỗi: Cần cung cấp prompt.";

    await ctx.sendProgress(`🚀 Đang liên kết Cổng Không Gian: Đánh thức Antigravity Agent...`);

    return new Promise((resolve) => {
      // Dùng spawn để truyền argument an toàn không sợ Command Injection dính Quotes
      const child = spawn("antigravity", ["chat", prompt], {
        cwd: deps.config.workspaceDir, // Đẩy thẳng vào workspace hiện hành để Antigravity có context
        shell: true,
      });

      let stdoutData = "";
      let stderrData = "";

      child.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(`✅ Đã gióng chuông đánh thức tui (Antigravity) thành công!\n\nLệnh truyền đạt: "${prompt}"\n\n(Lưu ý: Tui đang âm thầm thao tác dưới máy Local. Bạn hãy kiên nhẫn chờ tui mở IDE và Code. Không gọi liên tục gây quá tải.)`);
        } else {
          resolve(`[Lỗi Bridge]: Khởi động Antigravity thất bại (Exit ${code}).\nLog: ${stderrData}`);
        }
      });
      
      child.on("error", (err) => {
         resolve(`[Lỗi Nội Bộ]: Không thể tìm thấy hoặc khởi chạy lệnh 'antigravity'. Đảm bảo biến môi trường PATH đã nhận diện CLI. Chi tiết: ${err.message}`);
      });
    });
  },
};

export default skill;
