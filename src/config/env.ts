import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  // ── AI Provider ────────────────────────────────────────────────────────────
  // "anthropic" (default) | "openai" | "ollama"
  AI_PROVIDER: z.enum(["anthropic", "openai", "ollama"]).default("anthropic"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().default("auto"),

  // OpenAI / Ollama
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default(""),  // e.g. http://localhost:11434/v1 for Ollama

  // Image generation (Hugging Face) — token miễn phí tại huggingface.co/settings/tokens
  // Nếu không set, generate_image tool sẽ báo không khả dụng
  IMAGE_API_KEY: z.string().default(""),

  // Workspace dir cho file I/O tools (read_file, write_file, list_dir)
  WORKSPACE_DIR: z.string().default("./workspace"),

  // ── Model ─────────────────────────────────────────────────────────────────
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-6"),
  CLAUDE_MAX_TOKENS: z.coerce.number().default(8192),
  THINKING_BUDGET_TOKENS: z.coerce.number().default(4096),

  // ── System ────────────────────────────────────────────────────────────────
  SYSTEM_PROMPT: z.string().default(""),  // nếu trống, dùng DEFAULT_SYSTEM_PROMPT bên dưới
  DB_PATH: z.string().default("./data/clawbot.db"),
  GATEWAY_PORT: z.coerce.number().default(3000),
  STREAM_THROTTLE_MS: z.coerce.number().default(800),

  // ── History / Context ─────────────────────────────────────────────────────
  // Nâng max_turns lên 100 vòng (200 messages) để tránh bot quên task (âm mưu/kịch bản) khi tự thầu nguyên project
  MAX_HISTORY_TURNS: z.coerce.number().default(100),
  // Token budget cho context: Model Gemma 4 (trên Google Studio) hỗ trợ ~1M tokens. Nâng budget lên cực đại!
  // Mặc định 250k tokens (tương đương 1 triệu ký tự)
  MAX_CONTEXT_TOKENS: z.coerce.number().default(250000),

  // ── Access control ────────────────────────────────────────────────────────
  ALLOWED_USER_IDS: z.string().default(""),
  ADMIN_USER_ID: z.string().default(""),
  // Dùng cho Pairing Mode. Nếu để trống, ai không nằm trong ALLOWED_USER_IDS sẽ bị block cứng.
  PAIRING_CODE: z.string().default(""),
  BASH_TIMEOUT_MS: z.coerce.number().default(30000),

  // ── Exec approval ─────────────────────────────────────────────────────────
  // "always" = luôn hỏi | "never" = không hỏi (trust AI) | "smart" = chỉ hỏi lệnh nguy hiểm
  BASH_APPROVAL_MODE: z.enum(["always", "never", "smart"]).default("smart"),
  ALLOW_HOST_BASH: z.enum(["true", "false"]).default("false"),

  // ── Gateway WebSocket ──────────────────────────────────────────────────────
  // Nếu set, /ws endpoint yêu cầu ?token=<WS_SECRET> để kết nối
  WS_SECRET: z.string().default(""),

  // ── Notion Integration ─────────────────────────────────────────────────────
  NOTION_API_KEY: z.string().default(""),
  NOTION_DATABASE_ID: z.string().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const err of parsed.error.errors) {
    console.error(`  ${err.path.join(".")}: ${err.message}`);
  }
  process.exit(1);
}

// ─── Default system prompt ────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `<system_role>
Mày là Clawbot — Executive Assistant, Life Coordinator và Reflective Coach đáng tin cậy của NT777 chạy qua Telegram.
Môi trường: Windows, PowerShell. Workspace: ./workspace/.
Mục tiêu cốt lõi: Giúp NT777 sống có tổ chức hơn, giảm quá tải tinh thần. Chủ động nhắc nhở đúng thời điểm. Luôn ưu tiên sự hữu ích thực tế hơn là nói nhiều.
</system_role>

<core_directives>
  <directive>Chủ động có kiểm soát: Chỉ nhắc khi có lý do rõ ràng. Không làm NT777 quá tải.</directive>
  <directive>Nguyên tắc Ưu tiên: Luôn ưu tiên việc "quan trọng + gần hạn + dễ bị quên" (VD: lịch hẹn, deadline, thanh toán, giấy tờ).</directive>
  <directive>Giá trị hành động: Mỗi nhắc nhở phải nói rõ: việc gì, vì sao cần chú ý, khi nào làm, và BƯỚC TIẾP THEO ngắn nhất.</directive>
  <directive>Tôn trọng tự chủ: Không áp đặt, không phán xét. Đưa ra gợi ý mềm mại, hữu ích dựa trên lịch, deadline, mức năng lượng và ưu tiên cá nhân.</directive>
  <directive>Tone Voice: Ngắn gọn, ấm áp, hữu ích. Không robotic, không lý thuyết hóa. Xưng "mình", gọi "bạn" hoặc "NT777".</directive>
</core_directives>

<instructions>
  <instruction name="CÁCH SUY NGHĨ & CƠ CHẾ NHẮC NHỞ (BẮT BUỘC TRƯỚC KHI TRẢ LỜI)">
    Hãy dùng thẻ mở <thought> để tự nhẩm 5 câu hỏi trước khi trả lời:
    1. NT777 đang cần gì (hành động ngay/lên kế hoạch/trấn an/định hướng)?
    2. Có việc gì sắp đến hạn/dễ quên không?
    3. Thời điểm hiện tại hợp với loại nhắc nhở nào?
       - Sáng: Tóm tắt 1-3 ưu tiên, 1 việc dễ quên, 1 việc cần chuẩn bị, 1 bước khởi động.
       - Trưa/Giữa ngày: Check tiến độ, nhắc nghỉ ngắn/uống nước.
       - Chiều: Deadline còn sót.
       - Tối: Tổng kết ngắn, việc dang dở, việc nhớ cho ngày mai, chuẩn bị đồ đạc để sáng mai đỡ căng.
    4. Có cần nhắc chủ động không? (Chỉ nhắc khi việc quan trọng sắp tới hạn, rủi ro quên cao, hoặc nhắc lúc này giúp tiết kiệm thời gian). Chấm điểm, nếu thật sự có giá trị ưu tiên lớn thì tiến hành ở bước 5.
    5. Chọn 1 trong 4 Format sau để trả lời ra ngoài thẻ thought:
       A. Quick assist: Việc quan trọng nhất -> Làm ngay -> Nhắc thêm
       B. Daily focus: Hôm nay tập trung vào -> Việc nguy cơ quên -> Mốc giờ -> Bước bắt đầu
       C. Gentle proactive: Nhắc nhẹ -> Vì sao nên làm lúc này -> Bước ngắn nhất
       D. Overload rescue (Khi NT777 cáu/choáng ngợp do nhiều việc): Hiện tại đang quá tải -> Việc cần cắt giảm ngay -> Việc quan trọng nhất -> Kế hoạch 15p tới.
    [Chỉ viết phản hồi cuối dùng 1 trong 4 định dạng ra ngoài thẻ </thought>]
  </instruction>

  <instruction name="Absolute Tool Rule">
    TỐI KỴ việc nói "Để mình làm ngay" hoặc "Tôi đã nháp xong phần 1, bạn xem nhé" rồi dừng lại chờ user phản hồi.
    TUYỆT ĐỐI KHÔNG DỪNG GIỮA CHỪNG. Lời hứa phải đi kèm với Tool Use NGAY LẬP TỨC.
  </instruction>

  <instruction name="Super Document Rule">
    KHÔNG KHỞI TẠO tài liệu > 4000 từ trong một tệp duy nhất. Quy trình "Tằm Ăn Dâu": 
    1. CHIẾN LƯỢC TOÁN HỌC & CẤU TRÚC: Nếu yêu cầu X trang, 1 TRANG TƯƠNG ĐƯƠNG 400 TỪ. 
    LƯU Ý CHÍ MẠNG: KHI BẠN LÀ AI, BẠN RẤT KÉM TRONG VIỆC ĐẾM TỪ, ĐỪNG ẢO GIÁC RẰNG BẠN ĐÃ VIẾT DÀI! Nên để đảm bảo mỗi chương (chapter) thực sự đạt 800 - 1000 từ khi gọi 'append_to_file', bạn BẮT BUỘC phải dùng cấu trúc sau cho MỖI CHƯƠNG:
    - 1 Phân tích rễ gốc vấn đề (Tối thiểu 3 đoạn văn phức hợp).
    - 3 Ví dụ hoặc Case-Study thực tế RẤT CHI TIẾT (Có tên riêng, mốc thời gian, số liệu giả định nếu cần - mỗi case-study viết 3 đoạn văn).
    - Phân tích Đa Chiều (Góc nhìn ủng hộ/Phản đối, lợi ích/tác hại) (3 đoạn văn).
    - Tổng kết và Lời khuyên cực sâu khắc (2 đoạn văn).
    Chỉ khi tuân thủ Khối Cấu Trúc này, tài liệu của bạn mới đủ số lượng trang quy định! Không làm theo là phá sản dự án!
    3. Dùng 'write_file' viết Dàn ý và Phần 1.
    4. Dùng 'append_to_file' nối các Phần tiếp theo.
    5. Dùng 'compile_file' xuất file cuối.
  </instruction>

  <instruction name="Tools Behavior & Memory">
    Ưu tiên dùng Tool 'memory' để ghi nhớ tự động các thói quen của NT777 (giờ thức/ngủ, thói quen hay quên, khoảng thời gian tập trung, ưu tiên cuộc sống).
    Không bao giờ đưa lời khuyên pháp lý, y tế chuyên sâu nếu thiếu dữ liệu. Không tự bịa lịch hay ký ức sai.
    Tìm kiếm khi cần thông tin mới. Trình bày kết quả tự nhiên.
  </instruction>
</instructions>`;

export const config = {
  telegramBotToken: parsed.data.TELEGRAM_BOT_TOKEN,

  // AI provider
  aiProvider: parsed.data.AI_PROVIDER,
  anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
  openaiApiKey: parsed.data.OPENAI_API_KEY,
  openaiBaseUrl: parsed.data.OPENAI_BASE_URL || undefined,

  // Model
  model: parsed.data.CLAUDE_MODEL,
  maxTokens: parsed.data.CLAUDE_MAX_TOKENS,
  thinkingBudgetTokens: parsed.data.THINKING_BUDGET_TOKENS,

  // System
  systemPrompt: parsed.data.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
  dbPath: parsed.data.DB_PATH,
  gatewayPort: parsed.data.GATEWAY_PORT,
  streamThrottleMs: parsed.data.STREAM_THROTTLE_MS,

  // History / Context
  maxHistoryTurns: parsed.data.MAX_HISTORY_TURNS,
  maxContextTokens: parsed.data.MAX_CONTEXT_TOKENS,

  // Access
  allowedUserIds: parsed.data.ALLOWED_USER_IDS
    ? parsed.data.ALLOWED_USER_IDS.split(",").map((s) => s.trim()).filter(Boolean)
    : [],
  adminUserId: parsed.data.ADMIN_USER_ID.trim() || undefined,
  pairingCode: parsed.data.PAIRING_CODE,
  bashTimeoutMs: parsed.data.BASH_TIMEOUT_MS,
  bashApprovalMode: parsed.data.BASH_APPROVAL_MODE,
  allowHostBash: parsed.data.ALLOW_HOST_BASH === "true",

  // Image generation
  imageApiKey: parsed.data.IMAGE_API_KEY || parsed.data.OPENAI_API_KEY || "",

  // File I/O workspace
  workspaceDir: parsed.data.WORKSPACE_DIR,

  // Gateway
  wsSecret: parsed.data.WS_SECRET || undefined,

  // Notion
  notionApiKey: parsed.data.NOTION_API_KEY,
  notionDatabaseId: parsed.data.NOTION_DATABASE_ID,
} as const;

export type Config = typeof config;
