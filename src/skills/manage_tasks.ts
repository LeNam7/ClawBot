import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";
import { taskManager } from "../plugins/task.js";

const skill: Skill = {
  name: "manage_tasks",
  description: "Quản lý Bảng Checklist trên Telegram. Dùng CREATE để khởi tạo danh sách các công việc sẽ làm. Dùng UPDATE để cập nhật trạng thái khi tiến hành từng bước. LUÔN LUÔN tạo Checklist cho các tác vụ thay đổi mã nguồn phức tạp hơn 2 bước.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "update"],
        description: "Tạo mới hoặc Cập nhật."
      },
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            status: { type: "string", enum: ["pending", "doing", "done", "error"] },
            error_msg: { type: "string" }
          },
          required: ["id", "title", "status"]
        },
        description: "Mảng danh sách task. Khi UPDATE chỉ cần truyền những task cần update (cùng ID)."
      }
    },
    required: ["action", "tasks"]
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const action = args.action as string;
    const tasks = args.tasks as unknown as any[];
    
    if (action === "create") {
      taskManager.setTasks(ctx.msg.chatId, tasks);
    } else if (action === "update") {
      for (const t of tasks) {
        taskManager.updateTask(ctx.msg.chatId, t.id, t.status, t.error_msg);
      }
    }
    
    const markdown = taskManager.buildMarkdown(ctx.msg.chatId);
    // Gửi tin nhắn hoặc thay thế tin nhắn cũ
    const oldMsgId = taskManager.getMessageId(ctx.msg.chatId);
    
    const channel = deps.channelRegistry.get(ctx.msg.channel);
    if (channel && channel.send) {
      const sentId = await channel.send({
         channel: ctx.msg.channel,
         chatId: ctx.msg.chatId,
         text: markdown,
         editMessageId: oldMsgId,
         isFinal: false
      });
      
      if (sentId) {
         taskManager.setMessageId(ctx.msg.chatId, sentId);
      }
    }
    
    return "Đã đồng bộ Checklist lên Telegram thành công.";
  }
};

export default skill;
