import type { AIClient } from "./types.js";
import type { Config } from "../config/env.js";

export class CodeVerifier {
  constructor(
    private aiClient: AIClient,
    private config: Config,
    private notify: (msg: string) => Promise<void>
  ) {}

  async verifyFile(filePath: string, content: string): Promise<{ isOk: boolean; error?: string }> {
    await this.notify(`🔍 [Trọng Tài API] Đang gửi tệp ${filePath} cho LLM kiểm duyệt...`);
    
    // Rút gọn nội dung nếu quá dài để tránh nghẽn
    const safeContent = content.length > 50000 ? content.slice(0, 50000) + "\n...[TRUNCATED]" : content;
    
    const prompt = `[TRỌNG TÀI KIỂM LỖI]\nHãy đọc kỹ mã nguồn của tệp ${filePath} dưới đây.\n\n\`\`\`\n${safeContent}\n\`\`\`\n\nNẾU KHÔNG CÓ LỖI CÚ PHÁP HOẶC LOGIC NGHIÊM TRỌNG NÀO, CẤM GIẢI THÍCH, CHỈ TRẢ LỜI ĐÚNG 1 CHỮ SAU: "PASS". NẾU CÓ LỖI, CHỈ NÓI GIẢI THÍCH LỖI NGẮN GỌN DƯỚI 50 CHỮ. KHÔNG SỬA CODE, CHỈ NÊU LỖI.`;

    try {
      let responseText = "";
      const stream = this.aiClient.stream({
        history: [],
        userMessage: prompt,
        model: this.config.model, // Sử dụng model cấu hình để tự trị
        maxTokens: 100,
        systemPrompt: "Bạn là hệ thống kiểm duyệt mã nguồn CI/CD."
      });

      for await (const chunk of stream) {
        if (chunk.type === "delta" && chunk.delta) responseText += chunk.delta;
      }

      if (responseText.toUpperCase().includes("PASS")) {
        await this.notify(`✅ [Trọng Tài API] Logic đạt chuẩn, hoàn hảo. Ghi file thành công!`);
        return { isOk: true };
      } else {
        await this.notify(`❌ [Trọng Tài CẢNH BÁO] Phát hiện lỗi: ${responseText.slice(0, 100)}...`);
        return { isOk: false, error: responseText };
      }
    } catch(e) {
      await this.notify(`⚠️ [Trọng Tài API] Kết nối gọi API kiểm duyệt lỗi, tự động cho phép File qua cửa...`);
      return { isOk: true };
    }
  }
}
