/**
 * Model Router — tự động chọn model phù hợp dựa trên độ phức tạp của tin nhắn.
 *
 * Routing logic:
 * - SIMPLE  → claude-haiku-3-5   (nhanh, rẻ: chào hỏi, hỏi giờ, cảm ơn...)
 * - MEDIUM  → claude-sonnet-4-6  (mặc định: hỏi đáp thông thường, tóm tắt...)
 * - COMPLEX → claude-opus-4      (phức tạp: code, phân tích sâu, nhiều bước...)
 */

export type ComplexityLevel = "simple" | "medium" | "complex" | "extreme";

// ─── Simple patterns — câu ngắn, xã giao, không cần suy nghĩ ────────────────
const SIMPLE_PATTERNS = [
  /^(hi|hello|hey|chào|alo|halo|ờ|oke?|ok|yeah|yep|nope?|không|ko|có|vâng|dạ|ừ|ừm|hmm+|hm+)[\s!?.]*$/i,
  /^(cảm ơn|thanks?|thank you|tks|thx|camon|good|tốt|great|nice|tuyệt|xong|done|vậy thôi|thôi được|được rồi)[\s!?.]*$/i,
  /^(mấy giờ|giờ mấy|hôm nay thứ mấy|ngày bao nhiêu|what time|what day)[\s!?.]*$/i,
  /^(bạn có đó không|bạn đó không|bạn ơi|ping|test|thử xem)[\s!?.]*$/i,
];

// ─── Complex patterns — cần suy nghĩ sâu, nhiều bước ──────────────────────
const COMPLEX_PATTERNS = [
  // Code/lập trình
  /\b(code|debug|implement|refactor|optimize|fix bug|viết code|lập trình|thuật toán|algorithm|function|class|api|database|sql|query)\b/i,
  // Phân tích sâu
  /\b(phân tích|analyze|analysis|so sánh|compare|đánh giá|evaluate|review|chiến lược|strategy|roadmap|architecture)\b/i,
  // Yêu cầu dài/phức tạp
  /\b(giải thích chi tiết|explain in detail|hãy phân tích|step by step|từng bước|toàn bộ|comprehensive|đầy đủ)\b/i,
  // Tạo nội dung dài
  /\b(viết bài|write (a|an|the)|tạo (bài|báo cáo|tài liệu)|essay|report|proposal|plan|kế hoạch)\b/i,
  // Multi-step tasks
  /\b(và sau đó|rồi|tiếp theo|bước \d|step \d|first.*then|firstly|additionally)\b/i,
  // Câu hỏi dài (>80 ký tự thường phức tạp hơn)
];

export function classifyComplexity(
  message: string,
  history: Array<{ role: string; content: any }>
): ComplexityLevel {
  const trimmed = message.trim();

  // 1. Kiểm tra simple patterns
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(trimmed)) return "simple";
  }

  // 2. Tin nhắn rất ngắn (<15 ký tự) và không phải code → simple
  if (trimmed.length < 15 && !trimmed.includes("\`\`\`")) return "simple";

  // 3. Tin nhắn CỰC dài (>800 ký tự) hoặc chuỗi lịch sử đang duy trì quá nhiều vòng lặp -> extreme
  if (trimmed.length > 800 || history.length > 12) return "extreme";

  // 4. Đòi hỏi quy trình phức tạp (Extreme)
  const EXTREME_PATTERNS = [
    /\b(toàn bộ project|tất cả các bước|kiến trúc|tổng hợp tất cả|quy trình lớn|hàng loạt|xuyên suốt)\b/i
  ];
  for (const pattern of EXTREME_PATTERNS) {
    if (pattern.test(trimmed)) return "extreme";
  }

  // 5. Kiểm tra complex patterns (Code, logic sâu)
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(trimmed)) return "complex";
  }

  // 6. Tin nhắn dài (>200 ký tự) → có thể complex
  if (trimmed.length > 200) return "complex";

  // 7. Có code block → complex
  if (trimmed.includes("\`\`\`") || trimmed.includes("```")) return "complex";

  // 8. Mặc định → medium
  return "medium";
}

export function selectModel(
  complexity: ComplexityLevel,
  defaultModel: string
): string {
  // Ưu tiên Hybrid Routing cho API Google
  // Tránh đè model nếu user đang cấu hình cứng API của Anthropic (claude) hoặc local model khác.
  const isGoogleFamily = defaultModel.toLowerCase().includes("gemma") || defaultModel.toLowerCase().includes("gemini");
  
  if (isGoogleFamily) {
    switch (complexity) {
      case "simple":
        return "gemini-2.5-flash-lite";
      case "medium":
        return "gemini-2.5-flash";
      case "complex":
        return "gemma-4-26b-a4b-it";
      case "extreme":
        return "gemma-4-31b-it";
    }
  }

  // Tương tự, nếu có fallback routing hoặc logic khác, xử lý tại đây
  // OAuth / Mặc định -> return nguyên bản
  return defaultModel;
}
