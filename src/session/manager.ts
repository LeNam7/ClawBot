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

    if (totalChars <= budget) return messages;

    // Xóa từ đầu (cũ nhất) cho đến khi vừa ngân sách, giữ ít nhất 2 turns cuối
    const result = [...messages];
    let removedCount = 0;
    while (result.length > 2 && totalChars > budget) {
      const removed = result.shift()!;
      const removedContentLength = typeof removed.content === "string" 
        ? removed.content.length 
        : JSON.stringify(removed.content).length;
      totalChars -= removedContentLength;
      removedCount++;
    }

    // Đánh dấu cho Model biết một phần lịch sử đã bị cắt
    if (removedCount > 0 && result.length > 0) {
      for (let i = 0; i < result.length; i++) {
        if (result[i].role === "user") {
          const prefix = `_[Hệ thống: ${removedCount} đoạn hội thoại cũ nhất đã bị đưa vào lưu trữ (archive) để giảm giới hạn Context Window. Hãy tiếp tục dựa trên ngữ cảnh còn lại.]_\n\n`;
          if (typeof result[i].content === "string") {
            result[i].content = prefix + result[i].content;
          } else if (Array.isArray(result[i].content)) {
            // Giả định content là mảng các block của Anthropic (có text/tool_result/etc)
            // Ta chèn block text vào đầu mảng
            result[i].content = [
              { type: "text", text: prefix },
              ...result[i].content
            ];
          }
          break;
        }
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

  reset(key: SessionKey) {
    this.store.deleteTurns(key);
  }
}
