import type { Skill } from "../../ai/skill-loader.js";

export const skill: Skill = {
  name: "calculate",
  description: "Evaluate a mathematical expression",
  input_schema: {
    type: "object",
    properties: {
      expression: { type: "string", description: "Math expression, e.g. '(12 + 8) * 5 / 2'" },
    },
    required: ["expression"],
  },
  async execute({ expression }): Promise<string> {
    try {
      // Use a safe evaluation or a simple eval for this bot's context. 
      // In a real app, use a math library.
      const result = eval(expression.replace(/[^-()\d/*+.]/g, '')); 
      return String(result);
    } catch {
      return `Error evaluating expression: ${expression}`;
    }
  },
};
