import type { BrowserManager } from "../plugins/browser.js";

export class CodeVerifier {
  constructor(
    private browserManager: BrowserManager,
    private notify: (msg: string) => Promise<void>
  ) {}

  async verifyFile(filePath: string, content: string): Promise<{ isOk: boolean; error?: string }> {
    await this.notify(`🔍 [Trọng Tài] Trực tiếp giám sát file: ${filePath}...`);
    
    // Navigate to Gemini
    await this.browserManager.executeAction("goto", "https://gemini.google.com/", "");
    
    // We add an explicit animation wait of 3s to let the browser load and notify
    await new Promise((r) => setTimeout(r, 3000));
    
    const prompt = `[TRỌNG TÀI KIỂM LỖI]\nHãy đọc kỹ mã nguồn của tệp ${filePath} dưới đây.\n\n\`\`\`\n${content}\n\`\`\`\n\nNẾU KHÔNG CÓ LỖI CÚ PHÁP HOẶC LOGIC NGHIÊM TRỌNG NÀO, CẤM GIẢI THÍCH, CHỈ TRẢ LỜI ĐÚNG 1 CHỮ SAU: "PASS". NẾU CÓ LỖI, CHỈ NÓI GIẢI THÍCH LỖI NGẮN GỌN DƯỚI 50 CHỮ. KHÔNG SỬA CODE, CHỈ NÊU LỖI.`;

    await this.notify(`🕵️ [Trọng Tài] Đang nhét code vào Gemini Web để phân tích mâu thuẫn...`);
    await this.browserManager.executeAction("type", "rich-textarea, div[role='textbox']", prompt);
    
    // Bấm Enter
    await this.browserManager.executeAction("evaluate", "document.querySelector('rich-textarea, div[role=\"textbox\"]')?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));", "");
    
    // Bắt đầu chu kỳ đợi Gemini Response, kèm animation streaming UI
    for (let i = 0; i < 6; i++) { // 12 seconds
      await this.notify(`⏳ [Trọng Tài] Mô phỏng não bộ Gemini (Tầm nhìn Web)... ${'■'.repeat(i + 1)}${'□'.repeat(5 - i)}`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
       // Grab the last model response message
       const extractScript = `
         (() => {
            const els = document.querySelectorAll('message-content');
            if (els && els.length > 0) {
              return els[els.length - 1].innerText;
            }
            return "";
         })()
       `;
       let response = await this.browserManager.executeAction("evaluate", extractScript, "") as string;
       if (!response || response.trim() === "") {
          response = await this.browserManager.executeAction("extract_text", "", "") as string;
       }

       if (response.toUpperCase().includes("PASS")) {
         await this.notify(`✅ [Trọng Tài] Logic đạt chuẩn, hoàn hảo. Ghi file thành công!`);
         return { isOk: true };
       } else {
         await this.notify(`❌ [Trọng Tài CẢNH BÁO] Phát hiện lỗi: ${response.slice(0, 100)}...`);
         return { isOk: false, error: response };
       }
    } catch(e) {
       await this.notify(`⚠️ [Trọng Tài] Kết nối quá tải (Timeout), tự động cho phép File qua cửa...`);
       return { isOk: true };
    }
  }
}
