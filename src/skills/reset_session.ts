import fs from "node:fs";
import path from "node:path";
import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";

const skill: Skill = {
  name: "reset_session",
  description:
    "Clear the chat history and start a fresh conversation. Use when the user asks to reset, clear history, or start over.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const sessionKey = `${ctx.msg.channel}:${ctx.msg.chatId}`;
    deps.sessionManager.reset(sessionKey);
    
    // Xóa tệp tạm tải lên (Img2Img) của người dùng hiện tại
    try {
       const tmpDir = path.resolve("./data/tmp");
       if (fs.existsSync(tmpDir)) {
         const files = fs.readdirSync(tmpDir);
         for (const file of files) {
            if (file.startsWith(`upload_${ctx.msg.chatId}_`)) {
               fs.unlinkSync(path.join(tmpDir, file));
            }
         }
       }
    } catch (e) {
       console.error("[telegram] Failed to cleanup tmp files on reset", e);
    }
    return "Chat history cleared. Bất kỳ file tạm nào bạn đã tải lên cũng đã được xóa rác thành công.";
  }
};

export default skill;
