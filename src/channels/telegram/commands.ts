import type { Context } from "grammy";
import { registry } from "../../commands/registry.js";
import { registerAllCommands } from "../../commands/index.js";
import type { CommandDeps } from "../../commands/types.js";

// Đảm bảo commands được đăng ký khi module này được khởi tạo
let commandsRegistered = false;

export async function handleCommand(
  ctx: Context,
  command: string,
  deps: CommandDeps
): Promise<boolean> {
  if (!commandsRegistered) {
    registerAllCommands();
    commandsRegistered = true;
  }

  const text = (ctx.message as { text?: string })?.text ?? "";
  
  // Extract args after command (handle /cmd@botname args)
  const rawArgs = text.replace(/^[/]\S+\s*/, "").trim();

  const cmdLine = command.toLowerCase();
  const cmd = registry.get(cmdLine);

  if (cmd) {
    return await cmd.execute(ctx, rawArgs, deps);
  }

  return false;
}

// Re-export CommandDeps cho các file báo lỗi nếu có import cũ
export type { CommandDeps };
