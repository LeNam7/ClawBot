import fs from "node:fs/promises";
import path from "node:path";
import type { HandlerDeps } from "../pipeline/handler.js";
import { searchMemory } from "../memory/search.js";

export class ContextManager {
  constructor(private config: any) {}

  /**
   * Xây dựng System Prompt thông minh dựa trên câu hỏi của người dùng.
   */
  async buildSystemPrompt(query: string, deps: HandlerDeps): Promise<string> {
    const dataDir = path.dirname(this.config.dbPath);
    
    // 1. Load Permanent Context (Luôn luôn có)
    const soul = await this.safeRead(path.join(dataDir, "soul.md"), 1000);
    const user = await this.safeRead(path.join(dataDir, "user.md"), 1000);
    
    // 2. Dynamic Memory Retrieval (Chỉ lấy những gì liên quan)
    // Sử dụng logic của memory_search để tìm các đoạn ký ức phù hợp với query
    let memoryBlock = "";
    try {
      const memoriesDir = path.join(dataDir, "memories");
      const results = await searchMemory(query, memoriesDir);
      
      if (results && results.trim()) {
        memoryBlock = `\n\n[Ký ức liên quan được tìm thấy]:\n${results}`;
      } else {
        // Nếu không tìm thấy ký ức cụ thể, load một phần nhỏ memory.md làm nền
        const generalMemory = await this.safeRead(path.join(dataDir, "memory.md"), 500);
        memoryBlock = `\n\n[Ký ức chung]:\n${generalMemory}`;
      }
    } catch (err) {
      console.error("[ContextManager] error searching memory:", err);
    }

    // 3. Assemble final prompt
    const systemPrompt = this.config.systemPrompt;
    
    return `${systemPrompt}
---
${soul}
---
${user}
${memoryBlock}`;
  }

  private async safeRead(filePath: string, maxChars: number): Promise<string> {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return content.length > maxChars 
        ? content.slice(0, maxChars) + "\n...(truncated)" 
        : content;
    } catch {
      return "";
    }
  }
}
