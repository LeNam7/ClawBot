import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";

const skill: Skill = {
  name: "generate_image",
  description: "Vẽ ảnh bằng AI. Ảnh sẽ được tự động vẽ và tự động gửi trực tiếp vào phòng chat Telegram của User luôn. LƯU Ý: AI model vẽ ảnh giao tiếp tốt nhất bằng tiếng Anh, nên bạn luôn luôn phải DỊCH Prompt sang tiếng Anh, có thể phóng tác thêm các chi tiết nghệ thuật (lighting, style, 8k resolution, cinematic) để hình ảnh sinh ra rực rỡ và đẹp mắt nhất có thể.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Mô tả chi tiết bức ảnh mong muốn (BẰNG TIẾNG ANH)."
      }
    },
    required: ["prompt"]
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const prompt = encodeURIComponent(args.prompt ?? "A aesthetic artwork");
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
    
    await ctx.sendProgress(`Đang gọi vệ tinh không gian vẽ ảnh: ${args.prompt}...`);
    try {
      const resp = await fetch(url);
      if (!resp.ok) return `Lỗi báo từ máy chủ vẽ: HTTP ${resp.status}`;
      const buf = await resp.arrayBuffer();
      const nodeBuf = Buffer.from(buf);
      
      const channel = deps.channelRegistry.get(ctx.msg.channel);
      if (channel && channel.sendPhoto) {
        await channel.sendPhoto(ctx.msg.chatId, nodeBuf, `🖌 **Prompt:** ${args.prompt}`);
        return `Ảnh đã vẽ xong và gửi cho user qua Telegram!`;
      }
      return `Lỗi hệ thống: Kênh giao tiếp không hỗ trợ hoặc không tìm thấy phương thức gửi ảnh.`;
    } catch(e) {
       return `Lỗi nội bộ khi tải ảnh: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
};

export default skill;
