import { ISkill } from "../types.js";
import { z } from "zod";

const HelloSchema = z.object({
  name: z.string().describe("Tên của người cần được chào"),
});

const skill: ISkill<typeof HelloSchema> = {
  name: "hi",
  description: "Một skill đơn giản để chào hỏi người dùng.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Tên của người cần được chào",
      },
    },
    required: ["name"],
  },
  execute: async (args, context) => {
    return `Chào ${args.name}! Mình là Lucus, skill-loader đã hoạt động mượt mà rồi nhé! 🚀`;
  },
};

export default skill;
