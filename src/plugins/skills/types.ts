import { z } from "zod";

export interface ISkill<T extends z.ZodObject<any> = any> {
  name: string;
  description: string;
  input_schema: any; // JSON Schema format for AI function calling
  execute: (args: z.infer<T>, context: any) => Promise<string>;
}

export interface SkillDefinition {
  name: string;
  description: string;
  input_schema: any;
}

export interface SkillRegistry {
  [name: string]: ISkill<any>;
}
