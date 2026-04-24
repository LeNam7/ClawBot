import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { webSearch } from "../../plugins/search.js";

const skill: Skill = {
  name: "web_search",
  description:
    "Search the web for information. Use when the user asks about current events, facts, or anything that requires searching online.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
    },
    required: ["query"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    await ctx.sendProgress(`Đang tìm kiếm: "${args.query ?? ""}"`);
    return await webSearch(args.query ?? "");
  }
};

export default skill;
