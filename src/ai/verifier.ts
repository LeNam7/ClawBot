import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { AIClient } from "./types.js";
import type { Config } from "../config/env.js";

const execAsync = promisify(exec);
const retryMap = new Map<string, number>();

export class CodeVerifier {
  constructor(
    private aiClient: AIClient, // Vẫn giữ nguyên chữ ký hàm constructor để không bể Code bên ReplaceInFile
    private config: Config,
    private notify: (msg: string) => Promise<void>
  ) {}

// Rút gọn Promise thay đổi chút Type signature
  async verifyFile(filePath: string, content: string): Promise<{ isOk: boolean; error?: string; invokePostMortem?: boolean }> {
    const fullPath = path.resolve(this.config.workspaceDir, filePath);
    
    // 1. Phân Tích Rủi Ro 1: Ngắt Lặp Linter Vô Đích (Infinite Self-Correction Loop)
    const attempts = retryMap.get(fullPath) || 0;
    if (attempts >= 3) {
        await this.notify(`🔴 [Còi Báo Động] Quá 3 lần Terminal vẫn cự tuyệt mã nguồn. Tạm đình chỉ quyền hạn Sửa File và kích hoạt Luồng HỒI KÝ THẤT BẠI (Post-Mortem).`);
        retryMap.set(fullPath, 0); // Xoá nợ để lần cập nhật file sau còn kiểm tra
        return { isOk: true, invokePostMortem: true }; // Dùng cờ isOk: true để Bypass cửa vResult của ReplaceInFile, kèm cờ ép buộc gọi Memory_save
    }

    await this.notify(`🔍 [Trọng Tài Máy] Đang quét tĩnh (Syntax/Linter Check) trên tệp ${filePath}... (Lần thử ${attempts + 1}/3)`);
    
    const ext = path.extname(filePath).toLowerCase();
    let command = "";

    // Lựa chọn vũ khí Parser
    if (ext === ".ts" || ext === ".tsx") {
       command = `npx tsc --noEmit --skipLibCheck "${fullPath}"`;
    } else if (ext === ".js" || ext === ".jsx") {
       command = `node --check "${fullPath}"`;
    } else if (ext === ".py") {
       command = `python -m py_compile "${fullPath}"`;
    } else if (ext === ".php") {
       command = `php -l "${fullPath}"`;
    } else {
       await this.notify(`✅ [Trọng Tài Máy] Đuôi ${ext} chưa hỗ trợ Linter gốc. Auto Pass.`);
       return { isOk: true };
    }

    try {
      // 2. Chạy Compiler Process giới hạn 10 giây Timeout
      const { stdout, stderr } = await execAsync(command, { cwd: this.config.workspaceDir, timeout: 10000 });
      await this.notify(`✅ [Trọng Tài Máy] PASSED! Syntax Compiler báo xanh mượt.`);
      retryMap.delete(fullPath); // Xoá nợ khi Pass
      return { isOk: true };
    } catch (err: any) {
      retryMap.set(fullPath, attempts + 1); // Cập nhật thẻ phạt

      const rawError = err.stdout || err.stderr || err.message || "Unknown Compiler Error";
      const shortErr = rawError.toString().substring(0, 1500); // Ngăn LLM tràn RAM Context vì đọc Log quá dài
      
      await this.notify(`❌ [Trọng Tài Máy] PHÁT HIỆN LỖI CODE: Dừng quy trình.`);

      const strictPrompt = `[TRỌNG TÀI COMPILER CHỈ THỊ CẤP BÁCH]
Lệnh \`replace_in_file\` vừa rồi đã ghi file, NHƯNG Terminal Compiler / Linter dưới máy chủ phát hiện lỗi Cú Pháp / Logic Chí mạng!

Output Phân Tích Lỗi Của Terminal:
\`\`\`
${shortErr}
\`\`\`

Bạn còn ${3 - (attempts + 1)} lượt sửa sai. 
Yêu cầu bắt buộc: Đọc KỸ terminal log ở trên, suy nghĩ xem biến/hàm nào bị thừa/thiếu, sau đó GỌI LẠI Tool \`replace_in_file\` để vá lỗi đó ngay lập tức!
KHÔNG ĐƯỢC trả lời suông để nói chuyện mà CHƯA sửa xong lỗi đỏ!`;
      
      return { isOk: false, error: strictPrompt };
    }
  }
}
