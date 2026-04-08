import path from "node:path";
import { glob } from "fast-glob";
import { SkillRegistry, ISkill } from "../types/skill.js";

export class SkillLoader {
  constructor(private skillsDir: string) {}

  async loadSkills(): Promise<SkillRegistry> {
    const registry: SkillRegistry = {};
    
    // Tìm tất cả file .ts hoặc .js trong thư mục skills
    const files = await glob(path.join(this.skillsDir, "**/*.{ts,js}"));
    
    console.log(`[skill-loader] found ${files.length} skill files.`);

    for (const file of files) {
      try {
        // Dùng dynamic import để load module
        // Lưu ý: Với TypeScript trong môi trường dev, cần đảm bảo đường dẫn chuẩn
        const module = await import(file);
        
        // Kỳ vọng mỗi file export default một object tuân thủ ISkill
        const skill = module.default as ISkill;

        if (skill && skill.name && skill.execute) {
          registry[skill.name] = skill;
          console.log(`[skill-loader] loaded: ${skill.name}`);
        } else {
          console.warn(`[skill-loader] skipped ${file}: missing required ISkill properties.`);
        }
      } catch (err) {
        console.error(`[skill-loader] failed to load ${file}:`, err);
      }
    }

    return registry;
  }
}
