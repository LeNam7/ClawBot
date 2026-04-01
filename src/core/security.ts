import fs from "node:fs";
import path from "node:path";
import { config } from "../config/env.js";

interface IPairingState {
  isAllowed: boolean;
  message?: string;
  isNewlyPaired?: boolean;
}

export class SecurityManager {
  private whitelistedUsers = new Set<string>();
  private whitelistPath: string;

  constructor() {
    this.whitelistPath = path.join(path.dirname(config.dbPath), "whitelist.json");
    this.loadWhitelist();

    // Thêm tĩnh các user cố định từ config vào set
    for (const id of config.allowedUserIds) {
      this.whitelistedUsers.add(id);
    }
  }

  private loadWhitelist() {
    if (fs.existsSync(this.whitelistPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.whitelistPath, "utf8"));
        if (Array.isArray(data)) {
          for (const id of data) this.whitelistedUsers.add(String(id));
        }
      } catch (err) {
        console.error("[security] failed to load whitelist:", err);
      }
    }
  }

  private saveWhitelist() {
    try {
      // Chỉ lưu những ID không nằm trong hardcode config để tránh trùng lặp
      const dynamicUsers = Array.from(this.whitelistedUsers).filter(id => !config.allowedUserIds.includes(id));
      fs.writeFileSync(this.whitelistPath, JSON.stringify(dynamicUsers, null, 2), "utf8");
    } catch (err) {
      console.error("[security] failed to save whitelist:", err);
    }
  }

  /**
   * Kiểm tra xem user có được phép sử dụng bot không.
   * Nếu user nhắn tin chứa mã Pairing Code hợp lệ, họ sẽ được cấp quyền vĩnh viễn.
   */
  public checkAccess(userId: string, incomingText: string): IPairingState {
    // 1. Nếu hệ thống Open (không có allowed_users và không có pairing code) -> Cho phép hết
    if (config.allowedUserIds.length === 0 && !config.pairingCode) {
      return { isAllowed: true };
    }

    // 2. Nếu đã có trong danh sách
    if (this.whitelistedUsers.has(userId)) {
      return { isAllowed: true };
    }

    // 3. User chưa có quyền. Kiểm tra xem file cấu hình có bật chế độ Pairing Pin không
    if (!config.pairingCode) {
      // Nếu không cấu hình Pairing Code, chặn hoàn toàn
      return { isAllowed: false, message: "⛔ Bạn không có quyền truy cập Bot này." };
    }

    // 4. Nếu họ nhập đúng Pairing Code
    if (incomingText.trim() === config.pairingCode) {
      this.whitelistedUsers.add(userId);
      this.saveWhitelist();
      return { 
        isAllowed: true, 
        isNewlyPaired: true,
        message: "✅ Ghép nối thành công! Bạn đã được cấp quyền sử dụng hệ thống AI." 
      };
    }

    // 5. Nếu họ nhập sai hoặc nhắn tin bình thường
    return { 
      isAllowed: false, 
      message: "🔒 Hệ thống đang khoá. Vui lòng nhập mã PIN ghép nối (Pairing Code) để trò chuyện:" 
    };
  }
}
