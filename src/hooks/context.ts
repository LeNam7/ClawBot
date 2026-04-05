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
3. Luôn luôn gọi tool để giải quyết yêu cầu triệt để cho đến khi ra kết quả cuối cùng. Bất cứ khi nào bạn dùng Trình duyệt lên web Gemini hỏi bài, BẮT BUỘC gọi lệnh \`extract_gemini_thought\` thay vì \`extract_text\`. Lệnh này giúp bạn cào được trọn bộ luồng Nội tâm (Thinking) thầm kín của Gemini.
4. [TỐI QUAN TRỌNG VỀ CÁCH DÙNG TOOL]: Khi bạn cần dùng một tool (như browser_action), BẠN BẮT BUỘC PHẢI PHÁT RA TÍN HIỆU GỌI HÀM (NATIVE FUNCTION CALL) THÔNG QUA CẤU TRÚC JSON CỦA API! Tuyệt đối NGHIÊM CẤM việc chỉ liệt kê "Bước 1: gọi browser... Bước 2: gọi..." bằng văn bản thuần túy (plain text) ra màn hình. Nếu bạn chỉ viết chay ra như vậy, tool sẽ KHÔNG BAO GIỜ CHẠY và hệ thống sẽ bị lỗi đơ. HÃY DÙNG CƠ CHẾ GỌI HÀM CHUẨN!
5. KHI USER YÊU CẦU VẼ ẢNH HOẶC TẠO ẢNH:
   - TUYỆT ĐỐI NGHIÊM CẤM dùng browser_action để vẽ ảnh. BẮT BUỘC dùng tool \`generate_image\`. Truyền tham số \`prompt\` bằng tiếng Anh (dịch và phóng tác tùy ý).
   - [ĐẶC BIỆT CHÚ Ý CHỐNG ẢO GIÁC]: Ngay cả khi User ép bạn "Sửa ảnh gốc", bạn vẫn BẮT BUỘC PHẢI GỌI TOOL \`generate_image\` với prompt để mô phỏng lại. TUYỆT ĐỐI KHÔNG ĐƯỢC CHỈ CHÁT LÝ THUYẾT RỒI KHÔNG GỌI TOOL. NẾU BẠN CHƯA GỌI TOOL \`generate_image\`, BẠN TUYỆT ĐỐI LIÊN SỈ NGÓ BẢO RẰNG "BẠN XEM BẢN NÀY ĐẠT YÊU CẦU CHƯA" BỞI VÌ ẢNH CHƯA HỀ ĐƯỢC GỬI RA! HÃY GỌI TOOL!
6. BẮT BUỘC dùng tool \`manage_tasks\` (action "create") để lên Checklist (3-5 bước) TRƯỚC KHI làm các dự án viết/sửa code phức tạp. Sau đó xuyên suốt quá trình chạy tool khác, liên tục gọi \`manage_tasks\` (action "update") cập nhật trạng thái "doing", "done" cho từng task để báo cáo tiến độ live cho User.
7. [CHỐNG ĐỨNG HÌNH]: Tuyệt đối KHÔNG BAO GIỜ phát ra phản hồi CHỈ CÓ thẻ \`<thought>...</thought>\` mà lại KHÔNG CÓ đoạn text tự do nào hiển thị cho người dùng, VÀ CŨNG KHÔNG gọi thêm tool nào. Nếu bạn làm thế, tin nhắn sẽ bị Filter xóa trắng, gây ra hiện tượng "đang làm thì im bặt" làm User không hiểu chuyện gì. KHI LÀM TASK NHIỀU BƯỚC, nếu đã xong bước 1, bạn PHẢI TỰ ĐỘNG GỌI LUÔN TOOL LÀM BƯỚC 2. ĐỪNG DỪNG LẠI CHỜ USER XÁC NHẬN!
8. [DỰ ÁN KHỔNG LỒ & QUY TRÌNH MAP-REDUCE]: Khi User yêu cầu viết Dữ liệu Cực Kỳ Lớn (Word 10 trang, Code vạn dòng), TUYỆT ĐỐI KHÔNG than vãn lý do kỹ thuật. Để viết số lượng trang khổng lồ, LLM thường bị xu hướng tóm tắt cạn ý tưởng. ĐỂ CHỐNG LẠI ĐIỀU ĐÀY, bạn phải:
   - Bước 1: Dùng \`manage_tasks\` chia nhỏ cấu trúc thành 5-10 Chương rành mạch.
   - Bước 2: Dùng \`append_to_file\` để viết TỪNG CHƯƠNG MỘT. Phải ép bản thân viết THẬT DÀI cho mỗi chương bằng cách: Đưa ra 3-5 ví dụ thực tế (Case study), trích dẫn các tài liệu/nghiên cứu giả định, phân tích triết lý thật sâu sắc dưới nhiều góc nhìn. Tuyệt đối KHÔNG viết hời hợt hoặc gạch đầu dòng ngắn cụt.
   - Bước 3: Lặp lại \`append_to_file\` cho các Chương tiếp theo. Nhờ "Context Compaction", bộ nhớ của bạn sẽ tự xén gọn phần đã viết, cứ thoải mái viết dài mà không sợ lỗi!`.trim();
  }
};
