import fs from "node:fs";
import path from "node:path";
import type { ToolDefinition } from "./types.js";

export interface Skill {
  name: string;
  description: string;
  input_schema: any;
  execute: (input: any, deps: any) => Promise<string>;
}

export class SkillLoader {
  private skills: Map<string, Skill> = new Map();
  private skillsDir: string;
  private watchTimeout: NodeJS.Timeout | null = null;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;
  }

  clear(): void {
    this.skills.clear();
  }

  async loadSkills(force: boolean = false): Promise<void> {
    if (force) {
      this.clear();
    }

    console.log(`[SkillLoader] Loading skills from ${this.skillsDir}... ${force ? '(FORCE RELOAD)' : ''}`);
    
    if (!fs.existsSync(this.skillsDir)) {
      console.warn(`[SkillLoader] Skills directory does not exist: ${this.skillsDir}`);
      return;
    }

    const files = fs.readdirSync(this.skillsDir).filter(f => f.endsWith(".ts") || f.endsWith(".js"));
    
    for (const file of files) {
      try {
        const filePath = path.resolve(this.skillsDir, file);
        // Use dynamic import with a cache-busting query string to allow hot-reloading of ESM modules
        const module = await import(`file://${filePath}?update=${Date.now()}`);
        const skill = module.default || module.skill;

        if (skill && skill.name && typeof skill.execute === "function") {
          this.skills.set(skill.name, skill as Skill);
          console.log(`[SkillLoader] Registered skill: ${skill.name} (${file})`);
        } else {
          console.warn(`[SkillLoader] File ${file} does not export a valid Skill object (missing name or execute function).`);
        }
      } catch (err) {
        console.error(`[SkillLoader] Failed to load skill from ${file}:`, err);
      }
    }
    console.log(`[SkillLoader] Total skills loaded: ${this.skills.size}`);
  }

  watch(): void {
    console.log(`[SkillLoader] Watching for changes in ${this.skillsDir}...`);
    fs.watch(this.skillsDir, (eventType, filename) => {
      if (filename && (filename.endsWith(".ts") || filename.endsWith(".js"))) {
        if (this.watchTimeout) clearTimeout(this.watchTimeout);
        this.watchTimeout = setTimeout(() => {
          console.log(`[SkillLoader] Change detected in ${filename}. Reloading...`);
          this.loadSkills(true).catch(err => console.error("[SkillLoader] Auto-reload error:", err));
        }, 500);
      }
    });
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.skills.values()).map(s => ({
      name: s.name,
      description: s.description,
      input_schema: s.input_schema
    }));
  }

  async executeSkill(name: string, input: any, deps: any): Promise<string> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill ${name} not found.`);
    }
    return await skill.execute(input, deps);
  }
}
