import type { IHook, HookContext } from "./types.js";

class HookRegistry {
  private hooks: IHook[] = [];

  register(hook: IHook) {
    this.hooks.push(hook);
  }

  async runSessionStart(ctx: HookContext): Promise<string> {
    const outputs: string[] = [];
    for (const hook of this.hooks) {
      if (hook.onSessionStart) {
        try {
          const res = await hook.onSessionStart(ctx);
          if (res) outputs.push(res);
        } catch (err) {
          console.error(`[Hook] ${hook.name} failed onSessionStart`, err);
        }
      }
    }
    return outputs.join("\n\n");
  }

  async runPreToolUse(ctx: HookContext, toolName: string, input: any): Promise<{ allowed: boolean; reason?: string }> {
    for (const hook of this.hooks) {
      if (hook.onPreToolUse) {
        try {
          const res = await hook.onPreToolUse(ctx, toolName, input);
          if (!res.allowed) {
            return res; // Dừng ngay nếu bị block bởi hook
          }
        } catch (err) {
          console.error(`[Hook] ${hook.name} failed onPreToolUse`, err);
        }
      }
    }
    return { allowed: true };
  }
}

export const hookRegistry = new HookRegistry();
