import path from "node:path";
import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { searchMemory } from "../../memory/search.js";

const skill: Skill = {
  name: "memory_search",
  description:
    "Search through saved conversation history (memories) for relevant past discussions. " +
    "Use when the user references past conversations, asks 'what did we talk about', or seems to expect context from older chats.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Keywords or topic to search for in past conversations",
      },
    },
    required: ["query"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    await ctx.sendProgress(`Đang tìm trong memory: "${args.query ?? ""}"`);
    const memoriesDir = path.resolve(path.dirname(deps.config.dbPath), "memories");
    return await searchMemory(args.query ?? "", memoriesDir);
  }
};

export default skill;
