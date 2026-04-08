import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ToolDefinition, ToolHandler } from "../ai/types.js";
import type { HandlerDeps } from "../pipeline/handler.js";

/**
 * Interface cho một Skill (Tool) được định nghĩa trong file riêng biệt.
 * Mỗi file trong /src/skills/ phải export default một object thỏa mãn interface này.
 */
export interface Skill extends ToolDefinition {
  /** Logic thực thi của skill. Nhận vào các tham số đã parse và deps của bot. */
  execute: (args: any, deps: HandlerDeps) => Promise<string>;
}

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private readonly skillsDir: string;

  constructor(baseDir: string) {
    // Giả định baseDir là thư mục gốc của project, skills nằm trong src/skills
    this.skillsDir = path.join(baseDir, "src", "skills");
  }

  /**
   * Quét thư mục skills và load tất cả các file .ts hoặc .js
   */
  async loadSkills(): Promise<void> {
    console.log(`[skill-manager] scanning directory: ${this.skillsDir}`);
    
    try {
      // Đảm bảo thư mục tồn tại
      await fs.mkdir(this.skillsDir, { recursive: true });
      
      const files = await fs.readdir(this.skillsDir);
      const skillFiles = files.filter(f => f.endsWith(".ts") || f.endsWith(".js"));

      console.log(`[skill-manager] found ${skillFiles.length} skill files.`);

      for (const file of skillFiles) {
        if (file === "manager.ts" || file === "manager.js" || file === "types.ts") continue;

        const filePath = path.join(this.skillsDir, file);
        // Chuyển path thành file URL để import động hoạt động ổn định trên cả Windows/Linux
        const fileUrl = path.toNamespacedPath(filePath); 
        // Lưu ý: Với Node.js ESM, dùng file:// protocol là chuẩn nhất
        const importUrl = `file://${filePath.replace(/\\/g, '/')}`;

        try {
          // @ts-ignore - dynamic import của TS có thể báo lỗi nếu không có type declaration
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

  /**
   * Trả về ToolHandler để truyền vào AIClient
   */
  getToolHandler(): ToolHandler {
    return {
      tools: Array.from(this.skills.values()).map(s => ({
        name: s.name,
        description: s.description,
        input_schema: s.input_schema
      })),
      execute: async (name: string, input: unknown) => {
        const skill = this.skills.get(name);
        if (!skill) {
          throw new Error(`Skill "${name}" not found.`);
        }
        
        // Lưu ý: Ở đây mình cần deps. 
        // Nhưng getToolHandler() chưa nhận deps. 
        // Giải pháp: Truyền deps vào execute của ToolHandler lúc runtime trong handleInbound.
        // Tuy nhiên interface ToolHandler hiện tại của AIClient là:
        // execute: (name: string, input: unknown) => Promise<string>;
        // Nó KHÔNG nhận deps. 
        // => Mình sẽ dùng một trick: SkillManager sẽ lưu trữ deps sau khi khởi tạo.
        throw new Error("SkillManager.getToolHandler() must be called with deps or SkillManager must be initialized with deps.");
      }
    };
  }

  /**
   * Cách tiếp cận tốt hơn: Trả về một ToolHandler đã được bind sẵn với deps.
   */
  getToolHandlerWithDeps(deps: HandlerDeps): ToolHandler {
    return {
      tools: Array.from(this.skills.values()).map(s => ({
        name: s.name,
        description: s.description,
        input_schema: s.input_schema
      })),
      execute: async (name: string, input: unknown) => {
        const skill = this.skills.get(name);
        if (!skill) {
          throw new Error(`Skill "${name}" not found.`);
        }
        try {
          // Gọi skill với input đã được parse và deps
          return await skill.execute(input as any, deps);
        } catch (err: any) {
          console.error(`[skill-manager] error executing skill "${name}":`, err);
          return `Error executing skill "${name}": ${err.message}`;
        }
      }
    };
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}
