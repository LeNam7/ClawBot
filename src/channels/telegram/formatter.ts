// Escape text for Telegram MarkdownV2
const SPECIAL_CHARS = /[_*[\]()~`>#+\-=|{}.!\\]/g;

export function escapeMarkdownV2(text: string): string {
  return text.replace(SPECIAL_CHARS, (c) => `\\${c}`);
}

export function formatForTelegram(text: string): string {
  // Hoàn toàn xóa <thought>...</thought> và <think>...</think> ra khỏi kết quả cuối cùng
  let formattedText = text.replace(/<(thought|think)>[\s\S]*?(<\/\1>|$)/gi, "").trimStart();

  const parts = formattedText.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // code block — keep as-is
      return escapeMarkdownV2(part);
    })
    .join("");
}
