export interface Task {
  id: string;
  title: string;
  status: "pending" | "doing" | "done" | "error";
  error_msg?: string;
}

export class TaskManager {
  private tasks: Map<string, Task[]> = new Map();
  private messageIds: Map<string, string> = new Map();

  getTasks(chatId: string): Task[] {
    return this.tasks.get(chatId) || [];
  }

  setTasks(chatId: string, tasks: Task[]) {
    this.tasks.set(chatId, tasks);
  }

  updateTask(chatId: string, taskId: string, status: Task["status"], errorMsg?: string) {
    const list = this.tasks.get(chatId);
    if (!list) return;
    const task = list.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
      if (errorMsg) task.error_msg = errorMsg;
    }
  }

  getMessageId(chatId: string): string | undefined {
    return this.messageIds.get(chatId);
  }

  setMessageId(chatId: string, messageId: string) {
    this.messageIds.set(chatId, messageId);
  }

  clear(chatId: string) {
    this.tasks.delete(chatId);
    this.messageIds.delete(chatId);
  }

  buildMarkdown(chatId: string): string {
    const list = this.tasks.get(chatId);
    if (!list || list.length === 0) return "Không có tiến độ nào được ghi nhận.";

    let md = "📋 **TIẾN ĐỘ CẬP NHẬT TRỰC TIẾP**\n\n";
    for (const task of list) {
      let icon = "⬜";
      if (task.status === "doing") icon = "🔄";
      else if (task.status === "done") icon = "✅";
      else if (task.status === "error") icon = "❌";

      md += `${icon} ${task.title}\n`;
      if (task.status === "error" && task.error_msg) {
        md += `   _Lỗi: ${task.error_msg}_\n`;
      }
    }
    md += "\n_Đang tự động cập nhật..._";
    return md;
  }
}

export const taskManager = new TaskManager();
