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
      
      const items = await fs.readdir(this.skillsDir, { withFileTypes: true });

      for (const item of items) {
        if (item.name === "manager.ts" || item.name === "manager.js" || item.name === "types.ts") continue;

        let filePath = "";
        let folderPath = "";

        if (item.isDirectory()) {
          folderPath = path.join(this.skillsDir, item.name);
          // Auto-detect .ts or .js index file
          filePath = path.join(folderPath, "index.ts");
          try {
            await fs.access(filePath);
          } catch {
            filePath = path.join(folderPath, "index.js");
            try {
              await fs.access(filePath);
            } catch {
              continue; // Skip because no index file found
            }
          }
        } else if (item.name.endsWith(".ts") || item.name.endsWith(".js")) {
          filePath = path.join(this.skillsDir, item.name);
        } else {
          continue;
        }

        const importUrl = `file://${filePath.replace(/\\/g, '/')}`;

        try {
          const module = await import(importUrl);
          const skill = module.default as Skill;

          if (!skill || !skill.name || !skill.execute) {
            console.warn(`[skill-manager] ${item.name} does not export a valid Skill.`);
            continue;
          }

          // Ghi đè Description từ tệp SKILL.md (nếu có)
          if (folderPath) {
            const mdPath = path.join(folderPath, "SKILL.md");
            try {
              const mdContent = await fs.readFile(mdPath, "utf8");
              if (mdContent.trim()) {
                skill.description = mdContent;
              }
            } catch {} // Bỏ qua nếu không có file .md thiết lập
          }

          this.skills.set(skill.name, skill);
          console.log(`[skill-manager] loaded skill: ${skill.name}`);
        } catch (err) {
          console.error(`[skill-manager] failed to load ${item.name}:`, err);
        }
      }
    } catch (err) {
      console.error(`[skill-manager] error scanning skills directory:`, err);
    }
  }

  createToolHandler(deps: HandlerDeps, ctx: SkillContext, role: "frontdesk" | "worker" = "worker"): ToolHandler {
    const allowedFrontdeskTools = ["memory_search", "notion_manager", "delegate_task", "get_weather"];
    
    const localTools = Array.from(this.skills.values())
      .filter(s => role === "worker" || allowedFrontdeskTools.includes(s.name))
      .map(s => ({
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
        return `[HỆ THỐNG]: Tên Tool bị sai hoặc AI đang bị ảo giác (Tool "${name}" không tồn tại). Yêu cầu AI giữ thái độ chuyên nghiệp, tuyệt đối KHÔNG NHÉT CHỮ VÀO TÊN TOOL (name). Chỉ được xuất đúng tên Tool có phân loại sẵn như write_file, delegate_task, v.v.. Hãy gọi lại ngay Tool đúng.`;
      }
    };
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}
