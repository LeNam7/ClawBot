import type { Bot } from "grammy";
import { formatForTelegram } from "./formatter.js";

/**
 * TelegramStreamSender — tích lũy toàn bộ response rồi gửi 1 lần duy nhất.
 * Không stream-edit liên tục vì dễ bị race condition + text bị cắt.
 * Hiển thị "typing..." indicator trong lúc chờ.
 */
export class TelegramStreamSender {
  private fullText = "";
  private stopped = false;
  private messageId: number | null = null;
  private lastSentText: string | null = null;
  private flushInterval: NodeJS.Timeout | null = null;
  private flushPromise: Promise<void> | null = null;

  constructor(
    private bot: Bot,
    private chatId: number,
    private throttleMs: number = 1500
  ) {
    // Luôn báo typing song song cho đẹp UI
    void this.bot.api.sendChatAction(this.chatId, "typing").catch(() => {});
    
    this.flushInterval = setInterval(() => {
      if (!this.flushPromise) {
        this.flushPromise = this.flush().finally(() => {
          this.flushPromise = null;
        });
      }
    }, this.throttleMs);
  }

  private async flush(): Promise<void> {
    if (this.stopped) return;
    const text = this.fullText.trim();
    if (this.lastSentText !== null && text === this.lastSentText) return;

    // Tự động ẩn các "Quá trình suy nghĩ" ĐÃ KẾT THÚC (có thẻ đóng </thought> hoặc </think>)
    // Hủy bỏ chúng khỏi văn bản đang hiển thị để tránh rối mắt.
    let displayTxt = text.replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, " ");
    
    // Xử lý html
    let safeText = displayTxt.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let inThought = false;
    safeText = safeText.replace(/&lt;(thought|think)&gt;/gi, () => {
      inThought = true;
      return "<blockquote>💭 <i>Quá trình suy nghĩ:</i>\n";
    });
    safeText = safeText.replace(/&lt;\/(thought|think)&gt;/gi, () => {
      inThought = false;
      return "</blockquote>\n";
    });
    if (inThought) safeText += "</blockquote>";

    if (safeText.length > 4000) {
      safeText = safeText.slice(-4000);
    }
    
    // Đảm bảo ko bao giờ gửi text rỗng (fix lỗi 400 Bad Request)
    if (!safeText.trim()) {
       safeText = "💭 _Đang đọc tài liệu / Suy nghĩ..._"; 
    }
    
    safeText += " ✍️"; // Indicator con bot đang viết

    if (!this.messageId) {
      try {
        const result = await this.bot.api.sendMessage(this.chatId, safeText, { parse_mode: "HTML" });
        this.messageId = result.message_id;
        this.lastSentText = text;
      } catch (e) {
        console.error("[telegram-stream] send err:", e);
      }
    } else {
      try {
        await this.bot.api.editMessageText(this.chatId, this.messageId, safeText, { parse_mode: "HTML" });
        this.lastSentText = text;
      } catch (e) {
        // Ignore edit errors (often "message is not modified" or rate limit)
      }
    }
  }

  update(fullText: string): void {
    if (this.stopped) return;
    this.fullText = fullText;
  }

  async finalize(): Promise<void> {
    this.stopped = true;
    if (this.flushInterval) clearInterval(this.flushInterval);
    
    // Đợi nếu đang có lệnh edit/send dở dang để tránh Race Condition (Tạo 2 tin nhắn)
    if (this.flushPromise) {
      try { await this.flushPromise; } catch {}
    }

    const finalTxt = this.fullText.trim();
    if (!finalTxt) return;

    const chunks = this.splitMessage(finalTxt);
    
    // Nếu kết quả format ra chuỗi rỗng (AI chỉ gọi tool, không sinh ra text thường)
    // thì xóa luôn cái message "Đang suy nghĩ..." ban nãy
    if (chunks.length === 0) {
      if (this.messageId) {
        try { await this.bot.api.deleteMessage(this.chatId, this.messageId); } catch {}
      }
      return;
    }

    let isFirstChunk = true;

    for (const chunk of chunks) {
      // Tái sử dụng tin nhắn Draft hiện tại bằng cách Edit (mượt mà hơn là xóa đi tạo lại)
      if (isFirstChunk && this.messageId) {
        try {
          await this.bot.api.editMessageText(this.chatId, this.messageId, chunk, { parse_mode: "MarkdownV2" });
        } catch {
          try {
            await this.bot.api.editMessageText(this.chatId, this.messageId, chunk);
          } catch {
            // Hiếm khi xảy ra, trừ khi file gốc bị user xóa tay
            await this.bot.api.sendMessage(this.chatId, chunk);
          }
        }
      } else {
        try {
          await this.bot.api.sendMessage(this.chatId, chunk, { parse_mode: "MarkdownV2" });
        } catch {
          try {
            await this.bot.api.sendMessage(this.chatId, chunk);
          } catch (err) {
            console.error("[telegram] send error:", err);
          }
        }
      }
      isFirstChunk = false;
    }
  }

  async abort(): Promise<void> {
    this.stopped = true;
    if (this.flushInterval) clearInterval(this.flushInterval);
    if (this.messageId) {
       try {
         const abortedText = (this.fullText.trim() ? this.fullText.trim() + "\n\n" : "") + " *(Đã hủy)*";
         await this.bot.api.editMessageText(this.chatId, this.messageId, abortedText, { parse_mode: "MarkdownV2" });
       } catch {}
    }
  }

  private splitMessage(text: string, maxLen = 4096): string[] {
    const formatted = formatForTelegram(text).trim();
    if (!formatted) return [];

    if (formatted.length <= maxLen) return [formatted];
    
    const chunks: string[] = [];
    let remaining = formatted;
    while (remaining.length > 0) {
      let cutAt = maxLen;
      const lastNewline = remaining.lastIndexOf("\n", maxLen);
      if (lastNewline > maxLen * 0.6) cutAt = lastNewline + 1;
      chunks.push(remaining.slice(0, cutAt).trimEnd());
      remaining = remaining.slice(cutAt).trimStart();
    }
    return chunks;
  }

}
