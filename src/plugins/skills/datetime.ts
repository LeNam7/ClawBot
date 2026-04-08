import type { Skill } from "../../ai/skill-loader.js";

export const skill: Skill = {
  name: "get_datetime",
  description: "Get current date and time",
  input_schema: {
    type: "object",
    properties: {
      timezone: { type: "string", description: "IANA timezone, e.g. 'Asia/Ho_Chi_Minh'" },
    },
  },
  async execute({ timezone }): Promise<string> {
    const now = new Date();
    return now.toLocaleString("vi-VN", { timeZone: timezone || "Asia/Ho_Chi_Minh" });
  },
};
