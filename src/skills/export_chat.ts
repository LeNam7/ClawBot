import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";

function buildExportMarkdown(sessionKey: string, turns: any[]): string {
  let md = `# Trích xuất Hội thoại: ${sessionKey}\n\n`;
  for (const turn of turns) {
    const roleMap: Record<string, string> = {
      user: "### 👤 User",
      model: "### 🤖 AI",
      assistant: "### 🤖 AI",
      system: "### ⚙️ System",
      tool: "### 🛠️ Tool Result",
    };
    md += `${roleMap[turn.role] || `### ${turn.role}`}\n\n${turn.content}\n\n---\n\n`;
  }
  return md;
}

const skill: Skill = {
  name: "export_chat",
  description:
    "Export the current chat history as a Markdown file and send it to the user. Use when the user asks to export, save, or download the conversation.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    const sessionKey = `${ctx.msg.channel}:${ctx.msg.chatId}`;
    const turns = deps.sessionManager.getHistory(sessionKey);
    
    if (turns.length === 0) return "No chat history to export.";
    
    const content = buildExportMarkdown(sessionKey, turns);
    const filename = `chat-export-${Date.now()}.md`;
    
    const channel = deps.channelRegistry.get(ctx.msg.channel);
    if (channel && channel.sendDocument) {
      await channel.sendDocument(ctx.msg.chatId, content, filename, "📄 Chat history");
      return `Chat history exported (${turns.length} turns).`;
    }
    return `Chat history export failed: Channel does not support sending documents.`;
  }
};

export default skill;
