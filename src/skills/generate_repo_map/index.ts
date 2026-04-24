import fs from "node:fs/promises";
import path from "node:path";
import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";

const skill: Skill = {
  name: "generate_repo_map",
  description:
    "Quét toàn bộ thư mục src/ của dự án để lập Sơ Đồ Radar (Repository Map). Trích xuất tên các Class, Function, Interface và xuất ra file root .repo_map.md để AI nắm bắt kiến trúc tổng quan dự án.",
  input_schema: {
    type: "object",
    properties: {},
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    await ctx.sendProgress(`🗺️ Đang kích hoạt Radar quét toàn bộ vùng không gian (src/) để vẽ Sơ đồ cấu trúc...`);
    const srcDir = path.join(deps.config.workspaceDir, "src");
    
    let repoMap = "# TỌA ĐỘ BẢN ĐỒ MÃ NGUỒN (REPO MAP)\n\nMục lục này chứa toàn cục các Biến/Hàm/Class lõi của dự án giúp AI định chuẩn vị trí Code muốn sửa:\n\n";

    async function scanDir(dir: string, prefix = "") {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
           if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
           const fullPath = path.join(dir, entry.name);
           const relativePath = path.relative(deps.config.workspaceDir, fullPath);
           
           if (entry.isDirectory()) {
               await scanDir(fullPath, prefix);
           } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".py")) {
               const content = await fs.readFile(fullPath, "utf-8");
               const lines = content.split('\n');
               const symbols: string[] = [];
               
               const regex = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:class|function|const|let|interface|type)\s+([a-zA-Z0-9_]+)/;
               for (const line of lines) {
                   const match = line.trim().match(regex);
                   if (match && match[1]) {
                       symbols.push(match[1]);
                   }
               }
               
               if (symbols.length > 0) {
                   repoMap += `## 📄 ${relativePath.replace(/\\/g, '/')}\n`;
                   repoMap += `- Symbols: \`${symbols.join("`, `")}\`\n\n`;
               }
           }
        }
      } catch (e) {}
    }
    
    await scanDir(srcDir);
    // Nếu source không có thư mục src, quét root
    try { 
       await fs.access(srcDir); 
    } catch {
       await scanDir(deps.config.workspaceDir);
    }

    const mapPath = path.join(deps.config.workspaceDir, ".repo_map.md");
    await fs.writeFile(mapPath, repoMap, "utf-8");
    
    return `✅ Đã quét xong và lưu sơ đồ Radar vào file tại Root: .repo_map.md\nSơ đồ này sẽ tự động được hệ thống tiêm mớm vào System Context của bạn để giúp bạn không lạc lối khi code logic xuyên suốt nhiều file.`;
  }
};

export default skill;
