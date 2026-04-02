import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { handleInbound } from "../pipeline/handler.js";

export const BtwCommand: ICommand = {
  name: "/btw",
  description: "Hỏi nhanh không lưu lịch sử",
  category: "ai",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    if (!args || !deps.aiClient || !deps.channelRegistry) return false;

    void ctx.replyWithChatAction("typing");
    const inbound = {
      id: `telegram:btw:${ctx.from?.id}:${Date.now()}`,
      channel: "telegram" as const,
      userId: String(ctx.from?.id ?? "unknown"),
      chatId: String(ctx.chat?.id ?? "unknown"),
      text: args,
      receivedAt: new Date().toISOString(),
      raw: null,
    };
    await handleInbound(
      inbound,
      {
        sessionManager: deps.sessionManager,
        aiClient: deps.aiClient,
        channelRegistry: deps.channelRegistry,
        config: deps.config,
        browserManager: deps.browserManager!,
      },
      { noHistory: true }
    );
    return true;
  }
};
