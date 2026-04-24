import fs from "node:fs";
import path from "node:path";
import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";

const skill: Skill = {
  name: "memory_save",
  description:
    "Lưu trữ kiến thức, dữ liệu huấn luyện, thông tin quan trọng, hoặc thói quen của người dùng vào bộ nhớ dài hạn vector. Hãy dùng Tool này khi bạn vừa chắt lọc được kinh nghiệm, hoặc khi NT777 cấp cho bạn một luồng dữ liệu kiến thức mới cần học thuộc.",
  input_schema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Chủ đề ngắn gọn của kiến thức, viết liền không dấu bằng tiếng anh (ví dụ: user_preferences, tiktok_algorithm, sales_process)",
      },
      content: {
        type: "string",
        description: "Nội dung cần học thuộc hoặc ghi nhớ dài hạn (càng chi tiết càng tốt)",
      },
    },
    required: ["topic", "content"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const topic = (args.topic || "general_knowledge").replace(/[^a-zA-Z0-9_-]/g, "_");
    const content = args.content;
    
    if (!content) return "Lỗi: Nội dung truyền vào trống trơn.";
    
    await ctx.sendProgress(`Đang lưu kiến thức mới vào RAG Memory: [${topic}]...`);
    const memoriesDir = path.resolve(path.dirname(deps.config.dbPath), "memories");
    
    if (!fs.existsSync(memoriesDir)) {
      fs.mkdirSync(memoriesDir, { recursive: true });
    }
    
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const fileName = `${dateStr}_${topic}.md`;
    const filePath = path.join(memoriesDir, fileName);
    
    let fileContent = `# ${topic.toUpperCase()}\nNgày nạp: ${dateStr}\n\n${content}\n`;
    
    // Nếu tệp cùng ngày cùng chủ đề đã tồn tại, chèn nối thêm đằng trước
    if (fs.existsSync(filePath)) {
         let oldContent = fs.readFileSync(filePath, "utf8");
         fileContent = fileContent + "\n---\n" + oldContent;
    }

    fs.writeFileSync(filePath, fileContent, "utf8");
    
    return `Đã lưu trữ vĩnh viễn kiến thức vào Vector Memory (Tệp: ${fileName}). Lượng dữ liệu này sẽ tự động được Vector hóa và có thể móc lên bất kỳ lúc nào nếu dùng tool 'memory_search'.`;
  }
};

export default skill;
