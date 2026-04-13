import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";

const skill: Skill = {
  name: "get_weather",
  description: "Lấy thời tiết hiện tại của một thành phố. Trả về thông tin ngắn gọn.",
  input_schema: {
    type: "object",
    properties: {
      location: { type: "string", description: "Tên thành phố không dấu, ví dụ: 'Hanoi', 'Hồ Chí Minh', 'London'." }
    },
    required: ["location"]
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext): Promise<string> => {
    const location = args.location;
    if (!location) return "Yêu cầu cung cấp location.";
    try {
      // Dùng format=3 là dạng ngắn gọn (Ví dụ: Hanoi: ⛅️  +31°C)
      const url = `https://wttr.in/${encodeURIComponent(location)}?format=3`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "curl/7.68.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return `Lỗi API HTTP ${resp.status} khi lấy thời tiết cho "${location}"`;
      const text = await resp.text();
      return text.trim();
    } catch (e: any) {
      return `Lỗi kết nối khi lấy thời tiết cho "${location}": ${e.message}`;
    }
  }
};

export default skill;
