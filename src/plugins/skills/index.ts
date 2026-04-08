import path from "node:path";
import fg from "fast-glob";
import { ISkill, SkillRegistry, SkillDefinition } from "./types.js";
import type { HandlerDeps } from "../../pipeline/handler.js";

class SkillManager {
  private registry: SkillRegistry = {};
  private definitions: SkillDefinition[] = [];
  private isLoaded = false;

  constructor(private skillsDir: string) {}

  async ensureLoaded(force = false) {
    if (this.isLoaded && !force) return;
    
    if (force) {
      this.registry = {};
      this.definitions = [];
    }

    console.log(`[skill-manager] scanning folder: ${this.skillsDir}`);
    
    try {
      const files = await fg(path.join(this.skillsDir, "**/*.{ts,js}").replace(/\\/g, '/'));
      
      for (const file of files) {
        try {
          const absolutePath = path.resolve(file);
          const fileUrl = `file://${absolutePath.replace(/\\/g, '/')}`;
          
          const module = await import(fileUrl);
          const skill = module.default as ISkill;

          if (skill && skill.name && typeof skill.execute === "function" && skill.input_schema) {
            this.registry[skill.name] = skill;
            this.definitions.push({
              name: skill.name,
              description: skill.description,
              input_schema: skill.input_schema
            });
            console.log(`[skill-manager] loaded skill: ${skill.name}`);
          }
        } catch (err) {
          console.error(`[skill-manager] failed to load ${file}:`, err);
        }
      }
    } catch (err) {
      console.error(`[skill-manager] error scanning directory:`, err);
    }
    
    this.isLoaded = true;
    console.log(`[skill-manager] total skills loaded: ${this.definitions.length}`);
  }

  getDefinitions(): SkillDefinition[] {
    return this.definitions;
  }

  async executeSkill(name: string, args: any, deps: HandlerDeps): Promise<string> {
    const skill = this.registry[name];
    if (!skill) {
      throw new Error(`Skill "${name}" not found in registry.`);
    }
    return await skill.execute(args, deps);
  }
}

const skillsDir = path.join(process.cwd(), "src", "skills");
export const loader = new SkillManager(skillsDir);

export async function ensureLoaded(force = false) {
  await loader.ensureLoaded(force);
}

export async function reloadSkills() {
  await loader.ensureLoaded(true);
}

export type SkillResult = { output: string; skillName: string };

export async function runSkill(input: string, deps: HandlerDeps): Promise<SkillResult | null> {
  await ensureLoaded();
  
  const parts = input.trim().split(/\s+/);
  const skillName = parts[0]?.toLowerCase() ?? "";
  const argsStr = parts.slice(1).join(" ");

  const skills = loader.getDefinitions();
  const skill = skills.find(s => s.name.toLowerCase() === skillName);

  if (!skill) return null;

  try {
    const schema = skill.input_schema;
    const firstProp = Object.keys(schema.properties || {})[0];
    const inputObj = firstProp ? { [firstProp]: argsStr } : {};

    const output = await loader.executeSkill(skill.name, inputObj, deps);
    return { skillName: skill.name, output };
  } catch (err: any) {
    return { skillName: skill.name, output: `Error: ${err.message}` };
  }
}
