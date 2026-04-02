import type { Context } from "grammy";
import type { SessionManager } from "../session/manager.js";
import type { Config } from "../config/env.js";
import type { ChannelRegistry } from "../channels/registry.js";
import type { CronManager } from "../plugins/cron.js";

// Centralizing CommandDeps from telegram/commands.ts
export interface CommandDeps {
  sessionManager: SessionManager;
  config: Config;
  aiClient?: import("../ai/types.js").AIClient;
  channelRegistry?: ChannelRegistry;
  cronManager?: CronManager;
  browserManager?: import("../plugins/browser.js").BrowserManager;
}

export interface ICommand {
  name: string; // The primary command e.g. "/help"
  aliases?: string[]; // Alternate triggers e.g. "/new", "/reset"
  description: string;
  category?: "basic" | "advanced" | "ai" | "hidden";
  execute: (ctx: Context, args: string, deps: CommandDeps) => Promise<boolean>;
}
