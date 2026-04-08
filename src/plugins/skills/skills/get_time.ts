import { ISkill } from "../types.ts";
import { z } from "zod";

const GetTimeSchema = z.object({
  timezone: z.string().optional().describe("The timezone to get time for, e.g., 'Asia/Ho_Chi_Minh'"),
});

const skill: ISkill<typeof GetTimeSchema> = {
  name: "get_current_time",
  description: "Returns the current date and time for a specific timezone.",
  input_schema: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "The timezone to get time for, e.g., 'Asia/Ho_Chi_Minh'",
      },
    },
  },
  execute: async (args, context) => {
    const tz = args.timezone || "UTC";
    // For simplicity, we just return a string. 
    // In a real bot, we'd use a library like luxon or date-fns-tz.
    const now = new Date().toLocaleString("en-US", { timeZone: tz });
    return `The current time in ${tz} is ${now}.`;
  },
};

export default skill;
