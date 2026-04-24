import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";
import { fetchUrl } from "../../plugins/fetch.js";

const skill: Skill = {
  name: "fetch_url",
  description:
    "Fetch the text content of a URL. Use when the user asks to read a webpage, check a link, or get content from the internet.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to fetch, e.g. 'https://example.com'",
      },
    },
    required: ["url"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    await ctx.sendProgress(`Đang đọc: ${(args.url ?? "").slice(0, 60)}...`);
    return await fetchUrl(args.url ?? "");
  }
};

export default skill;
