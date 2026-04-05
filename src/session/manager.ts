import type { MessageParam } from "../ai/types.js";
import type { SessionKey } from "../core/types.js";
import { SessionStore } from "./store.js";

// Rough token estimate: 4 chars ≈ 1 token
const CHARS_PER_TOKEN = 4;

export class SessionManager {
  constructor(
    private store: SessionStore,
    private maxTurns: number,
    private maxContextTokens: number = 80000
  ) {}

  private makeKey(channel: string, userId: string, chatId: string): SessionKey {
    return `${channel}:${userId}:${chatId}`;
  }

  getOrCreate(channel: string, userId: string, chatId: string) {
    const key = this.makeKey(channel, userId, chatId);
    const existing = this.store.getSession(key);
    if (!existing) {
      this.store.upsertSession({ key, channel, userId, chatId });
    }
    return key;
  }

  getHistory(key: SessionKey): MessageParam[] {
    const turns = this.store.getTurns(key, this.maxTurns * 2);
    const messages: MessageParam[] = turns.map((t) => ({
      role: t.role as MessageParam["role"],
      content: t.content,
      tool_calls: t.tool_calls,
      tool_call_id: t.tool_call_id,
      name: t.name,
    }));
    return this.pruneByTokens(messages);
  }

  /**
   * Cắt bớt lịch sử từ đầu nếu tổng token vượt quá maxContextTokens.
   * Luôn giữ lại cặp turn cuối cùng để tránh mất ngữ cảnh gần nhất.
   */
  private pruneByTokens(messages: MessageParam[]): MessageParam[] {
    const budget = this.maxContextTokens * CHARS_PER_TOKEN; // chars

    let totalChars = messages.reduce((sum, m) => {
      if (typeof m.content === "string") return sum + m.content.length;
      return sum + JSON.stringify(m.content).length;
    }, 0);

    let removedCount = 0;
    const result = [...messages];
    
    // 1. Cắt cho đến khi vừa ngân sách (chừa lại block cuối)
    while (result.length > 2 && totalChars > budget) {
      const removed = result.shift()!;
      const removedContentLength = typeof removed.content === "string" 
        ? removed.content.length 
        : JSON.stringify(removed.content).length;
      totalChars -= removedContentLength;
      removedCount++;
    }

    // 2. Bảo toàn tính toàn vẹn của Anthropic API (Không được mồ côi tool_result và phải bắt đầu bằng user)
    // Luôn chạy bước này để chống lại việc store.getTurns() cắt ngẫu nhiên
    while (result.length > 0) {
      const first = result[0];
      let needsShift = false;
      
      if (first.role !== "user") {
        needsShift = true;
      } else if (Array.isArray(first.content) && first.content.some((c: any) => c.type === "tool_result" || c.type === "tool_use")) {
        needsShift = true;
      }
      
      if (needsShift) {
        const removed = result.shift()!;
        const removedContentLength = typeof removed.content === "string" 
          ? removed.content.length 
          : JSON.stringify(removed.content).length;
        totalChars -= removedContentLength;
        removedCount++;
      } else {
        break; // Tìm thấy điểm bắt đầu hợp lệ
      }
    }

    // Đánh dấu cho Model biết một phần lịch sử đã bị cắt
    if (removedCount > 0 && result.length > 0) {
      const prefix = `_[Hệ thống: ${removedCount} đoạn hội thoại cũ đã bị xóa để tối ưu bộ nhớ.]_\n\n`;
      if (typeof result[0].content === "string") {
        result[0].content = prefix + result[0].content;
      } else if (Array.isArray(result[0].content)) {
        result[0].content = [
          { type: "text", text: prefix },
          ...result[0].content
        ];
      }
    }

    return result;
  }

  appendUserTurn(key: SessionKey, content: any) {
    this.store.appendTurn(key, {
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    });
  }

  appendAssistantTurn(key: SessionKey, content: any) {
    this.store.appendTurn(key, {
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    });
  }

  appendFullTurn(key: SessionKey, message: MessageParam) {
    this.store.appendTurn(key, {
      ...message,
      createdAt: new Date().toISOString(),
    });
  }

  reset(key: SessionKey) {
    this.store.deleteTurns(key);
  }
}
