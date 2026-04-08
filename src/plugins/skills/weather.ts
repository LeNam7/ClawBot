import type { Skill } from "../../ai/skill-loader.js";

export const skill: Skill = {
  name: "get_weather",
  description: "Get current weather for a location",
  input_schema: {
    type: "object",
    properties: {
      location: { type: "string", description: "City or location name" },
    },
    required: ["location"],
  },
  async execute({ location }): Promise<string> {
    try {
      const url = `https://wttr.in/${encodeURIComponent(location)}?format=3`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "curl/7.68.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return `Could not fetch weather for "${location}"`;
      const text = await resp.text();
      return text.trim();
    } catch {
      return `Could not fetch weather for "${location}"`;
    }
  },
};
