import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";
import fs from "node:fs";
import path from "node:path";

const skill: Skill = {
  name: "generate_image",
  description: "Vẽ ảnh bằng AI. LƯU Ý: DỊCH Prompt vẽ sang tiếng Anh. Ảnh sẽ tự động gửi thẳng vào phòng chat Telegram của User luôn. Nếu user CÓ GẮN KÈM một bức ảnh thật và yêu cầu BẠN VẼ LẠI / SỬA ĐỔI CHI TIẾT trên ảnh đó (Inpainting/Img2Img), bắt buộc phải truyền use_uploaded_image: true, khi đó AI sẽ dùng cấu trúc ảnh gốc để hoạ lại chi tiết.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Mô tả chi tiết bức ảnh mong muốn (BẰNG TIẾNG ANH). Phóng tác thêm chi tiết (lighting, style) để ảnh thêm đẹp."
      },
      use_uploaded_image: {
        type: "boolean",
        description: "Set = true NẾU user vừa mới gửi 1 bức ảnh vào chat và yêu cầu CHỈNH SỬA / VẼ ĐÈ lên ảnh đó (giữ lại cấu trúc cũ). NẾU HỌ KHÔNG GỬI ẢNH NÀO thì không gửi tham số này."
      }
    },
    required: ["prompt"]
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const prompt = encodeURIComponent(args.prompt ?? "A aesthetic artwork");
    let finalUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;

    if (args.use_uploaded_image) {
      const tmpDir = path.resolve("./data/tmp");
      let latestImage: string | null = null;
      let latestTime = 0;
      
      if (fs.existsSync(tmpDir)) {
          const files = fs.readdirSync(tmpDir);
          const prefix = `upload_${ctx.msg.chatId}_`;
          for (const file of files) {
             if (file.startsWith(prefix) && file.endsWith(".jpg")) {
                const filePath = path.join(tmpDir, file);
                const stats = fs.statSync(filePath);
                if (stats.mtimeMs > latestTime) {
                   latestTime = stats.mtimeMs;
                   latestImage = filePath;
                }
             }
          }
      }

      if (latestImage) {
         if (deps.config.imageApiKey?.startsWith("hf_")) {
            await ctx.sendProgress("Xác nhận lệnh Inpainting. Đang gửi ảnh gốc vào Máy Chủ phân tích Kiến Trúc (Hugging Face) để tái tạo...");
            try {
               const fileBuf = fs.readFileSync(latestImage);
               const base64Str = fileBuf.toString('base64');
               
               const hfRes = await fetch("https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix", {
                  method: "POST",
                  headers: {
                      "Authorization": `Bearer ${deps.config.imageApiKey}`,
                      "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                      inputs: base64Str,
                      parameters: {
                          prompt: args.prompt
                      }
                  }),
               });

               if (hfRes.ok) {
                  const outBuf = await hfRes.arrayBuffer();
                  const nodeBuf = Buffer.from(outBuf);
                  
                  const channel = deps.channelRegistry.get(ctx.msg.channel);
                  if (channel && channel.sendPhoto) {
                    await channel.sendPhoto(ctx.msg.chatId, nodeBuf, `🖌 **[Hugging Face Img2Img] Prompt:** ${args.prompt}`);
                    return `Ảnh đã vẽ xong dựa trên kết cấu gốc và gửi cho user qua Telegram!`;
                  }
                  return `Hoàn tất nhưng không thể gửi ảnh do lỗi hạ tầng Telegram.`;
               } else {
                  const errorText = await hfRes.text();
                  return `⚠️ [LỖI HỆ THỐNG]: Hugging Face báo lỗi HTTP ${hfRes.status}: ${errorText}. Dừng thao tác vĩnh viễn, KHÔNG ĐƯỢC CHUYỂN SANG VẼ TEXT2IMG. Hãy trả lời để xin lỗi user.`;
               }
            } catch (e) {
               return `⚠️ [LỖI HỆ THỐNG]: Không thể tải file hoặc gọi API (${String(e)}). KHÔNG CHUYỂN SANG VẼ TEXT MÒ. Báo cho user sự cố.`;
            }
         } else {
            return "⚠️ [TỪ CHỐI THỰC THI]: User yêu cầu Img2Img để giữ kiến trúc, nhưng thiết lập .env thiếu IMAGE_API_KEY (Hugging Face). Bạn hãy báo thẳng cho user quá trình vẽ bị từ chối do thiếu API Key chứ TUYỆT ĐỐI KHÔNG vẽ lấp liếm bằng chữ (Text2Img) làm hỏng bố cục.";
         }
      } else {
         return "⚠️ [TỪ CHỐI THỰC THI]: Bạn được yêu cầu phân tích ảnh gửi lên, nhưng không tìm thấy file ảnh gốc nào trong bộ nhớ tạm thời. Hãy báo người dùng vui lòng gửi lại ảnh kèm dòng lệnh.";
      }
    } else {
      // -------------------------------------------------------------
      // PHÂN NHÁNH THUẦN TEXT2IMG (NHỮNG TÁC VỤ VẼ ẢNH KHÔNG CẦN CẤU TRÚC GỐC)
      // -------------------------------------------------------------
      await ctx.sendProgress(`Trạm không gian đang khởi tạo quá trình vẽ (Text2Img): ${args.prompt}...`);
      try {
        let resp = await fetch(finalUrl);
        if (!resp.ok) return `Lỗi báo từ máy chủ vẽ: HTTP ${resp.status}`;
        
        const buf = await resp.arrayBuffer();
        const nodeBuf = Buffer.from(buf);
        
        const channel = deps.channelRegistry.get(ctx.msg.channel);
        if (channel && channel.sendPhoto) {
          await channel.sendPhoto(ctx.msg.chatId, nodeBuf, `🖌 **Prompt:** ${args.prompt}`);
          return `Ảnh đã vẽ xong và gửi cho user qua Telegram!`;
        }
        return `Lỗi hệ thống: Kênh giao tiếp không hỗ trợ hoặc không tìm thấy phương thức gửi ảnh.`;
      } catch(e) {
         return `Lỗi nội bộ khi tải ảnh: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }
};

export default skill;
