import type { IHook, HookContext } from "./types.js";
import { shouldRequireApproval } from "../core/approval_rules.js";
import { createApproval } from "../pipeline/approval.js";

export const SecurityHook: IHook = {
  name: "security-guidance",

  onPreToolUse: async (ctx: HookContext, toolName: string, input: any) => {
    if (toolName === "run_bash") {
      const command = input.command ?? "";
      const needsApproval = shouldRequireApproval(command, ctx.deps.config.bashApprovalMode);
      
      if (needsApproval) {
        const channel = ctx.deps.channelRegistry.get(ctx.channel);
        if (!channel.sendApprovalMessage) {
          return { allowed: false, reason: "Execution blocked: command requires approval but channel does not support it." };
        }

        const { approvalId, promise } = createApproval(ctx.chatId, ctx.userId);
        
        try {
          await channel.sendApprovalMessage(ctx.chatId, approvalId, command);
        } catch (e) {
          return { allowed: false, reason: "Execution blocked: failed to send approval message." };
        }

        const result = await promise;
        
        if (result === "approved") {
          return { allowed: true };
        } else if (result === "rejected") {
          return { allowed: false, reason: `Execution rejected by user: ${command}` };
        } else {
          return { allowed: false, reason: `Execution timed out waiting for approval: ${command}` };
        }
      }
    }
    return { allowed: true };
  }
};
