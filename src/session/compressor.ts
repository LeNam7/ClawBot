import type { SessionManager } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";
import type { SessionKey } from "../core/types.js";
import type { MessageParam } from "../ai/types.js";

const COMPRESSOR_SYSTEM_PROMPT = `Mày là Trajectory Compressor (Bộ Nén Ký Ức Đa Tầng).
Nhiệm vụ của mày: Đọc toàn bộ lịch sử trò chuyện dưới đây (đã trở nên quá dài và sắp tràn bộ nhớ) và TÓM TẮT CHẮT LỌC LẠI nó thành một CỤC KÝ ỨC CỐT LÕI.
Ký ức này sẽ được dùng làm ngữ cảnh đầu vào cho Bot trong tương lai, để Bot luôn nhớ:
- Người dùng đang làm dự án gì, mục tiêu cuối cùng là gì?
- Các sự kiện, quyết định quan trọng, công cụ đã thiết lập.
- Thói quen, sở thích, tính cách đặc thù của người dùng được thể hiện.
- Trạng thái các task (còn gì đang dang dở).

Tuyệt đối không xưng hô, không giải thích. Trả về đúng 1 đoạn văn bản thuần mang tính lưu trữ thông tin cực kỳ đậm đặc. Bao bọc bản tóm tắt bởi thẻ XML <compressed_history>...</compressed_history>.`;

export class SessionCompressor {
  // Tránh việc nén liên tục cùng một session
  private isCompressing = new Set<string>();

  constructor(
    private sessionManager: SessionManager,
    private tokenThreshold: number
  ) {}

  // Hàm đếm ước chừng số token
  private estimateTokens(messages: MessageParam[]): number {
    let totalChars = 0;
    for (const m of messages) {
      if (typeof m.content === "string") totalChars += m.content.length;
      else totalChars += JSON.stringify(m.content).length;
    }
    return Math.floor(totalChars / 4); // Cấu hình 4 chars = 1 token
  }

  // Được gọi tự động, hoàn toàn không chặn flow chính
  public checkAndCompressAsync(key: SessionKey, deps: HandlerDeps) {
    if (this.isCompressing.has(key)) return;

    // Lấy nguyên lịch sử (kể cả những đoạn đã bị prunePrefix chặn nếu có)
    const rawHistory = this.sessionManager.getStore().getTurns(key, deps.config.maxHistoryTurns);
    const estimatedTokens = this.estimateTokens(rawHistory);

    if (estimatedTokens > this.tokenThreshold) {
      console.log(`\n[Compressor] ĐÃ KÍCH HOẠT! Ký ức đạt ${estimatedTokens}/${deps.config.maxContextTokens} tokens. Tiến hành nén...`);
      this.isCompressing.add(key);
      
      this.executeCompression(key, rawHistory, deps)
        .catch(err => {
          console.error("[Compressor] Lỗi trong quá trình nén:", err);
        })
        .finally(() => {
          this.isCompressing.delete(key);
        });
    }
  }

  private async executeCompression(key: SessionKey, rawHistory: any[], deps: HandlerDeps) {
    const { aiClient, config } = deps;
    
    // Gom toàn bộ lịch sử thành 1 tin nhắn User để ném cho AI đọc
    const historyText = rawHistory.map(t => {
       const contentStr = typeof t.content === "string" ? t.content : JSON.stringify(t.content);
       return `[${t.role.toUpperCase()}] (${t.createdAt}):\n${contentStr}\n---`;
    }).join("\n");

    const userMessage = "LỊCH SỬ TRÒ CHUYỆN:\n" + historyText;

    // Để giữ an toàn, ta chỉ nén 80% thời lượng đầu, chừa lại 20% cuộc nói chuyện gần nhất để Bot không mất mạch truyện.
    const turnsToCompress = Math.floor(rawHistory.length * 0.8);
    if (turnsToCompress <= 2) return; // Quá ít turn để nén

    // Chạy lệnh độc lập cho AI
    let summary = "";
    try {
      const stream = aiClient.stream({
        history: [], // Không cần history cũ vì đã bơm vào userMessage
        userMessage: userMessage,
        model: config.model,
        maxTokens: 4096, // Budget lớn cho summary
        systemPrompt: COMPRESSOR_SYSTEM_PROMPT
      });

      for await (const event of stream) {
        if (event.type === "delta" && event.delta) {
          summary += event.delta;
        }
      }
    } catch (e: any) {
       console.error("[Compressor] Khởi chạy AI Clients thất bại", e);
       return;
    }

    // Sau khi nén xong, cập nhật thay máu Database
    // Phải quét kỹ đề phòng trường hợp User vừa nhắn nhiều tin mới trong lúc nén
    // Thay vì xóa toàn bộ, ta gọi replaceTurnsWithSummary
    const summaryTurn = {
        role: "assistant" as const, // Gán là assistant để model nghĩ đây là trí nhớ của chính nó
        content: `_[Hệ thống đính kèm: Ký ức đã được nén]_\n${summary}`,
        createdAt: new Date().toISOString()
    };

    // Đẩy xuống cho Store bứng gốc 80% turns đầu tiên
    this.sessionManager.getStore().replaceTurnsWithSummary(key, turnsToCompress, summaryTurn);
    console.log(`[Compressor] HOÀN TẤT! Đã cô đặc ${turnsToCompress} turns cũ thành 1 Ký ức lõi.`);
  }
}
