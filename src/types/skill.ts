import { z } from "zod";

export interface ISkill<T extends z.ZodObject<any> = any> {
  name: string;
  description: string;
  parameters: T;
  execute: (args: z.infer<T>, context: any) => Promise<string>;
}

export interface SkillRegistry {
  [key: string]: ISkill<any>;
}
