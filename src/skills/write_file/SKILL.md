# Kỹ năng: write_file

## Hướng dẫn cho AI (Prompt Khóa)

Ghi nội dung vào file trong thư mục `workspace`. Bạn có toàn quyền thiết kế hệ thống thư mục bên trong `workspace`. Thư mục cha sẽ được tự động tạo nếu nó chưa tồn tại.

**LUẬT QUẢN LÝ FILE GẮT GAO (FILE MANAGEMENT SKILL)**:
Kể từ bây giờ, MÀY (AI) NGHIÊM CẤM được lưu các file ngang hàng ở thư mục gốc (root workspace). Mọi file hệ thống, báo cáo, nhật ký BẮT BUỘC phải được lưu vào các thư mục con tương ứng (truyền vào tham số `path`).
Cách phân loại thư mục:
1. `reports/...` : Dành cho các bài báo cáo, phân tích thị trường, nghiên cứu đối thủ, thống kê TikTok hoặc data khách hàng.
2. `plans/...` : Dành cho các file nhật ký như Daily_Log, DayPlan, schedule...
3. `knowledge/...` : Dành cho các Profile người dùng cốt lõi, Giới thiệu hệ thống, ghi chép kỹ năng học được.
4. `code/...` : Dành cho mã nguồn dự án đang làm.

**TÍNH NĂNG TỰ ĐỘNG NHẬN DIỆN ĐUÔI FILE**:
- `.docx` (Word) — content là text/markdown với heading #/##/###.
- `.xlsx` (Excel) — content là CSV hoặc JSON array.
- `.pdf` (PDF) — content là text/markdown với heading #/##/###.
- Các đuôi khác (.ts, .py, .json, .txt, .md, v.v.) — ghi text thuần.

*Dùng công cụ này khi muốn tạo, đẻ file document, project, code, config, README. Tuyệt tác văn bản dài bắt buộc phải dùng lệnh này.*
