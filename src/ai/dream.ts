import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import { Config } from "../config/env.js";
import { AIClient } from "./types.js";

// Lên lịch Job tự động chạy lúc 3:00 AM mỗi đêm
export function startDreamingService(config: Config, aiClient: AIClient, notifyAdmin?: (text: string) => Promise<void>) {
   cron.schedule("0 3 * * *", async () => {
      await dream(config, aiClient, notifyAdmin);
   });
   console.log("[Dreaming] Đã lên lịch Cronjob Ngủ Mơ Ký Ức lúc 03:00 AM.");
}

// Logic ngủ mơ
export async function dream(config: Config, aiClient: AIClient, notifyAdmin?: (text: string) => Promise<void>) {
    if (notifyAdmin) {
       try { await notifyAdmin("💤 [Hệ thống] Bắt đầu quá trình Ngủ mơ (Memory Dreaming)..."); } catch {}
    }
    
    const dbDir = path.dirname(config.dbPath);
    const sessionsDir = path.join(dbDir, "sessions");
    const memoriesDir = path.join(dbDir, "memories"); // Để lưu memory

    if (!fs.existsSync(memoriesDir)) fs.mkdirSync(memoriesDir, { recursive: true });
    if (!fs.existsSync(sessionsDir)) return;

    let compressedCount = 0;
    const files = fs.readdirSync(sessionsDir);
    for (const file of files) {
       if (file.endsWith(".json")) {
           const filePath = path.join(sessionsDir, file);
           const raw = fs.readFileSync(filePath, "utf-8");
           let session;
           try {
              session = JSON.parse(raw);
           } catch { continue; }
           
           if (!session.turns || session.turns.length < 5) continue; // Phớt lờ hội thoại ngắn không đáng nhớ
           
           // Nén giấc mơ
           const historyText = session.turns.map((t: any) => `${t.role}: ${t.content}`).join("\\n").substring(0, 50000); // Limit context
           const prompt = `[CHẾ ĐỘ NGỦ MƠ VÀ ĐÓNG GÓI KÝ ỨC]\\nHãy đọc kỹ toàn bộ đoạn hội thoại sau. Lọc đi các chi tiết rườm rà và TÓM TẮT CÔ ĐỌNG những Bài học (Learnings), Bước tiến dự án, Lỗi đã giải quyết, và Ngôn ngữ/Sở thích của người dùng.\\n\\nXuất ra đúng chuẩn JSON:\\n{ "summary": "...", "important_facts": ["..."], "user_preferences": ["..."] }\\n\\nHISTORY:\\n${historyText}`;
           
           try {
              let responseText = "";
              const stream = aiClient.stream({
                history: [],
                userMessage: prompt,
                model: config.model,
                maxTokens: 1000,
                systemPrompt: "Bạn là module đồi thị (hippocampus) trong hệ thống AI, có nhiệm vụ nén ký ức ngắn hạn (session) thành ký ức dài hạn (memory) cô đọng."
              });

              for await (const chunk of stream) {
                 if (chunk.type === "delta" && chunk.delta) responseText += chunk.delta;
              }
              
              const memoryPath = path.join(memoriesDir, `${session.userId}.json`);
              let memoryBase: any = { session_summaries: [] };
              if (fs.existsSync(memoryPath)) {
                 try { memoryBase = JSON.parse(fs.readFileSync(memoryPath, "utf-8")); } catch {}
                 if (!memoryBase.session_summaries) memoryBase.session_summaries = [];
              }

              // Try parse JSON
              const jsonStart = responseText.indexOf("{");
              const jsonEnd = responseText.lastIndexOf("}");
              if (jsonStart !== -1 && jsonEnd !== -1) {
                  const chunkJson = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1));
                  chunkJson.date = new Date().toISOString();
                  chunkJson.original_session_id = session.key;
                  memoryBase.session_summaries.push(chunkJson);
                  fs.writeFileSync(memoryPath, JSON.stringify(memoryBase, null, 2));
              }

              // Xóa file session cũ để giải phóng não bộ cục bộ
              fs.unlinkSync(filePath);
              compressedCount++;
              
           } catch (e) {
              console.error("[Dreaming Error] Failed to compress session", session.key, e);
           }
       }
    }
    
    if (notifyAdmin) {
       try { await notifyAdmin(`🌅 [Hệ thống] Xong giấc ngủ. Đã nén thành công ${compressedCount} vùng ký ức ngẫu nhiên.`); } catch {}
    }
}
