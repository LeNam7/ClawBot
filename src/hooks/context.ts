import type { IHook, HookContext } from "./types.js";

export const DynamicContextHook: IHook = {
  name: "dynamic-context",

  onSessionStart: (ctx: HookContext) => {
    const now = new Date();
    const vnTime = now.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    
    const hour = parseInt(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "numeric", hour12: false }));
    const greeting =
      hour >= 5 && hour < 11 ? "buổi sáng" :
      hour >= 11 && hour < 14 ? "buổi trưa" :
      hour >= 14 && hour < 18 ? "buổi chiều" :
      hour >= 18 && hour < 22 ? "buổi tối" : "đêm khuya";

    return `
---
[CONTEXT THỜI GIAN THỰC]
Giờ hiện tại: ${vnTime} (${greeting})
Khi chào hỏi, dùng đúng thời điểm "${greeting}" — KHÔNG dùng lời chào sai giờ.

[QUY TẮC BẮT BUỘC KHÁC]
1. KHI GỌI TOOL BẤT KỲ CÓ LIÊN QUAN ĐẾN ĐƯỜNG DẪN WINDOWS (path/command), TUYỆT ĐỐI KHÔNG DÙNG 1 DẤU GẠCH CHÉO NGƯỢC (\\). LUÔN sử dụng '/' (ví dụ: 'C:/Users/PC/clawbot') hoặc '\\\\' (ví dụ: 'C:\\\\Users\\\\PC\\\\clawbot') ĐỂ TRÁNH LỖI JSON ESCAPE!
2. TUYỆT ĐỐI KHÔNG BAO GIỜ NÓI LÝ THUYẾT RỒI DỪNG. Nếu bạn nói "mình sẽ kiểm tra" hoặc "để mình xem", BẠN PHẢI GỌI TOOL NGAY TRONG CÙNG MỘT LƯỢT CHAT ĐÓ. Nếu bạn không có tool để làm việc đó, HÃY NÓI THẲNG "Mình không có tool để làm việc này" rồi kết thúc, không được placeholder.
3. Luôn luôn gọi tool để giải quyết yêu cầu triệt để cho đến khi ra kết quả cuối cùng.
4. KHI USER YÊU CẦU VẼ ẢNH HOẶC TẠO ẢNH: Tuyệt đối KHÔNG tìm kiếm tool generate_image cũ. Bạn BẮT BUỘC phải dùng luồng Agentic: Gọi \`browser_action\` \`goto\` vào \`https://gemini.google.com/\` -> Dùng \`evaluate\` hoặc \`type\` tìm ô chat (div có contenteditable="true" hoặc rich-textarea) và điền lệnh vẽ ảnh -> Tự tìm và click nút submit (hoặc gọi Enter qua evaluate/JS) -> Đợi khoảng 15-20 giây để ảnh load -> Gọi \`browser_action\` \`element_screenshot\` truyền CSS selector của chính bức ảnh vừa tạo (để extract và gửi ảnh trực tiếp cho User qua Telegram, không dùng \`screenshot\` chụp full trang).`.trim();
  }
};
