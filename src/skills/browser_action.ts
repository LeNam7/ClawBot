import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";

const skill: Skill = {
  name: "browser_action",
  description: "Điều khiển trình duyệt ảo (Headless). Hỗ trợ điều hướng, click, gõ text, trích xuất text, chụp ảnh và chạy JS. LƯU Ý: Khi gọi screenshot hoặc element_screenshot, ẢNH ĐƯỢC CHỤP SẼ TỰ ĐỘNG GỬI TRỰC TIẾP QUA TELEGRAM CHO USER.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["goto", "click", "type", "scroll", "extract_text", "screenshot", "element_screenshot", "evaluate", "download", "extract_image", "upload", "extract_gemini_thought"],
        description: "Hành động cần thực thi."
      },
      target: {
        type: "string",
        description: "URL (dành cho goto), CSS Selector (dành cho click/type), hoặc JS Code (dành cho evaluate)."
      },
      value: {
        type: "string",
        description: "Text cần gõ (dành cho type) hoặc 'up'/'down' (dành cho scroll)."
      }
    },
    required: ["action"]
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const action = args.action ?? "";
    const target = args.target ?? undefined;
    const value = args.value ?? undefined;
    
    await ctx.sendProgress(`Đang điều khiển trình duyệt: ${action} ${target || ''}`.trim());
    const result = await deps.browserManager.executeAction(action, target, value);
    
    if (Buffer.isBuffer(result)) {
      const isImage = result.length > 4 && (
        (result[0] === 0xFF && result[1] === 0xD8) || // JPEG
        (result[0] === 0x89 && result[1] === 0x50 && result[2] === 0x4E && result[3] === 0x47) || // PNG
        (result[0] === 0x47 && result[1] === 0x49 && result[2] === 0x46) || // GIF
        (result[0] === 0x52 && result[1] === 0x49 && result[2] === 0x46 && result[3] === 0x46) // WEBP
      );

      const channel = deps.channelRegistry.get(ctx.msg.channel);
      if (channel) {
        if (isImage && channel.sendPhoto) {
          await channel.sendPhoto(ctx.msg.chatId, result, undefined);
          return "Đã chụp/tải ảnh màn hình và gửi thành công.";
        } else if (channel.sendFileBuffer) {
          await channel.sendFileBuffer(ctx.msg.chatId, result, `downloaded_file_${Date.now()}.bin`, "Đã tải xuống thành công.");
          return "Đã tải tập tin và gửi nguyên gốc file cho người dùng thành công.";
        }
      }
    }
    return result as string;
  }
};

export default skill;
