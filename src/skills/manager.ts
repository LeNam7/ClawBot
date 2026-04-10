import fs from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolHandler } from "../ai/types.js";
import type { HandlerDeps } from "../pipeline/handler.js";
import type { InboundMessage } from "../core/types.js";

export interface SkillContext {
  msg: InboundMessage;
  sendProgress: (text?: string) => Promise<void>;
}

/**
 * Interface cho một Skill (Tool) được định nghĩa trong file riêng biệt.
 * Mỗi file trong /src/skills/ phải export default một object thỏa mãn interface này.
 */
export interface Skill extends ToolDefinition {
  /** Logic thực thi của skill. Nhận vào các tham số đã parse, deps của hệ thống, và context của tin nhắn. */
  execute: (args: any, deps: HandlerDeps, ctx: SkillContext) => Promise<string>;
}

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private readonly skillsDir: string;

  constructor(baseDir: string) {
    this.skillsDir = path.join(baseDir, "src", "skills");
  }

  async loadSkills(): Promise<void> {
    console.log(`[skill-manager] scanning directory: ${this.skillsDir}`);
    
    try {
      await fs.mkdir(this.skillsDir, { recursive: true });
      
      const files = await fs.readdir(this.skillsDir);
      const skillFiles = files.filter(f => f.endsWith(".ts") || f.endsWith(".js"));

      for (const file of skillFiles) {
        if (file === "manager.ts" || file === "manager.js" || file === "types.ts") continue;

        const filePath = path.join(this.skillsDir, file);
        const importUrl = `file://${filePath.replace(/\\/g, '/')}`;

        try {
          const module = await import(importUrl);
          const skill = module.default as Skill;

          if (!skill || !skill.name || !skill.execute) {
            console.warn(`[skill-manager] file ${file} does not export a valid Skill (missing name or execute).`);
            continue;
          }

          this.skills.set(skill.name, skill);
          console.log(`[skill-manager] loaded skill: ${skill.name}`);
        } catch (err) {
          console.error(`[skill-manager] failed to load ${file}:`, err);
        }
      }
    } catch (err) {
      console.error(`[skill-manager] error scanning skills directory:`, err);
    }
  }

  createToolHandler(deps: HandlerDeps, ctx: SkillContext): ToolHandler {
    const localTools = Array.from(this.skills.values()).map(s => ({
      name: s.name,
      description: s.description,
      input_schema: s.input_schema
    }));

    return {
      tools: localTools,
      execute: async (name: string, input: unknown) => {
        const skill = this.skills.get(name);
        if (skill) {
          try {
            return await skill.execute(input as any, deps, ctx);
          } catch (err: any) {
            console.error(`[skill-manager] error executing skill "${name}":`, err);
            return `Lỗi thực thi kỹ năng "${name}": ${err.message}`;
          }
        }

        throw new Error(`Skill "${name}" not found.`);
      }
    };
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}
