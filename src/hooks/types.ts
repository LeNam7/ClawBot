import { HandlerDeps } from "../pipeline/handler.js";

export interface HookContext {
  chatId: string;
  userId: string;
  channel: string;
  deps: HandlerDeps;
  historySize: number;
}

export interface IHook {
  name: string;
  // Cho phép hook gắn thêm context động vào system prompt
  onSessionStart?: (ctx: HookContext) => Promise<string | undefined> | string | undefined;
  // Cho phép hook can thiệp trước khi tool được thực thi
  onPreToolUse?: (ctx: HookContext, toolName: string, input: any) => Promise<{ allowed: boolean; reason?: string }>;
}
