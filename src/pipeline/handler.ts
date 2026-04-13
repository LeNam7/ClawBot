import type { InboundMessage } from "../core/types.js";
import { SkillManager } from "../skills/manager.js";
const skillManager = new SkillManager(process.cwd());
let skillsLoaded = false;
export async function ensureSkillsLoaded() {
  if (!skillsLoaded) { 
    await skillManager.loadSkills(); 
    skillsLoaded = true; 
  }
}
import type { AIClient, ToolHandler, ToolDefinition } from "../ai/types.js";
import type { SessionManager } from "../session/manager.js";
import type { ChannelRegistry } from "../channels/registry.js";
import type { Config } from "../config/env.js";
import type { CronManager } from "../plugins/cron.js";
import { registerStream, deregisterStream } from "./active-streams.js";
import { createApproval } from "./approval.js";
import { hookRegistry, initHooks } from "../hooks/index.js";
import path from "node:path";
import fs from "node:fs";
import { classifyComplexity, selectModel } from "../ai/router.js";
import type { BrowserManager } from "../plugins/browser.js";
import { SkillLoader } from "../ai/skill-loader.js";
import type { ContextManager } from "../core/context.js";

initHooks();

// ─── Dangerous command patterns (requires approval in "smart" mode) ───────────
const DANGEROUS_PATTERNS = [
  /rm\s+-rf?/i,
  /del\s+\/[sqf]/i,        // Windows del /s /q /f
  /rmdir\s+\/s/i,          // Windows rmdir /s
  /format\s+[a-z]:/i,
  /mkfs/i,
  /dd\s+if=/i,
  /shutdown|reboot|halt/i,
  />\s*\/dev\/(sd|hd|nvme)/i,
  /curl.*\|\s*(bash|sh|zsh)/i,
  /wget.*\|\s*(bash|sh|zsh)/i,
  /:\(\)\s*\{/,             // fork bomb
  /chmod\s+[0-7]*7[0-7]*\s+\//i,
  // Windows PowerShell Core Threats
  /Remove-Item(\s+-Recurse|\s+-Force|\s+-Confirm|\s+-\w+)*\s+([A-Za-z]:[\\/]|\\)/i,
  /Invoke-WebRequest|iwr\s+/i,
  /Invoke-RestMethod|irm\s+/i,
  /Set-ExecutionPolicy/i,
  /Stop-Process|taskkill/i,
  /net\s+user/i,
  /Start-Process.*-Verb\s+RunAs/i,
  /Set-ItemProperty.*HKLM/i,
  /New-ItemProperty/i,
  /Remove-ItemProperty/i,
  /Clear-ItemProperty/i,
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command));
}

// ─── Tool definitions ────────────────────────────────────────────────────────

// Tools dynamically loaded via SkillManager

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HandlerDeps {
  sessionManager: SessionManager;
  aiClient: AIClient;
  channelRegistry: ChannelRegistry;
  config: Config;
  cronManager?: CronManager;
  browserManager: BrowserManager;
  contextManager?: ContextManager;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleInbound(
  msg: InboundMessage,
  deps: HandlerDeps,
  opts: { noHistory?: boolean } = {}
): Promise<void> {
  const { sessionManager, aiClient, channelRegistry, config, cronManager, browserManager } = deps;
  const channel = channelRegistry.get(msg.channel);
  const memoriesDir = path.join(path.dirname(config.dbPath), "memories");

  // Extract image data if present
  const raw = msg.raw as Record<string, unknown> | null;
  const imageBase64 = typeof raw?.imageBase64 === "string" ? raw.imageBase64 : undefined;
  const imageMimeType = typeof raw?.mimeType === "string" ? raw.mimeType : undefined;

  // Session
  const sessionKey = sessionManager.getOrCreate(msg.channel, msg.userId, msg.chatId);
  const history = opts.noHistory ? [] : sessionManager.getHistory(sessionKey);

  // Inject system note for Img2Img uploaded files
  const uploadedImagePath = typeof raw?.uploadedImagePath === "string" ? raw.uploadedImagePath : undefined;
  if (uploadedImagePath) {
    msg.text += `\n\n_[HỆ THỐNG: User có đính kèm một file ảnh. Kênh Telegram đã lưu ảnh này vào ổ cứng Server tại đường dẫn tuyệt đối: ${uploadedImagePath}. Nếu bạn muốn đưa hình ảnh này vào trang web Gemini để phân tích hoặc chỉnh sửa (img2img/analyze), hãy dùng tool browser_action gọi lệnh \`upload\` nhắm vào nút <input type="file"> và truyền \`value\` là đường dẫn \`${uploadedImagePath}\` này nhé.]_`;
  }

  // We don't save the user turn here anymore to avoid duplicate context, it will be saved at the end if the request succeeds.

  // Register abort controller
  const controller = registerStream(msg.chatId);

  // Helper: Hiển thị tiến trình UI rõ ràng giúp người dùng hết cảm giác bị mù (Blind UX)
  let progressMsgId: string | undefined;
  let keepAliveCallback: (() => void) | undefined;
  const sendProgress = async (text?: string) => {
    try {
      if (!progressMsgId) {
        progressMsgId = await channel.send({ 
          channel: msg.channel, 
          chatId: msg.chatId, 
          text: `⏳ Đang xử lý...`, 
          isFinal: false 
        });
      } else if (text && channel.send) {
        // Cập nhật trạng thái Tool thật sự để User có thể đọc thay vì "Không update text nữa"
        await channel.send({ 
          channel: msg.channel, 
          chatId: msg.chatId, 
          text: `⏳ ${text}`, 
          isFinal: false, 
          editMessageId: progressMsgId 
        });
      }
    } catch { /* ignore */ }
  };

  // Ensure dynamic skills are loaded
  await ensureSkillsLoaded();

  // Tool executor
  const skContext = { msg, sendProgress };
  const baseToolHandler = skillManager.createToolHandler(deps, skContext);
  
  const toolHandler: ToolHandler = {
    tools: baseToolHandler.tools,
    execute: async (name, input): Promise<string> => {
      const pingInterval = setInterval(() => {
        if (keepAliveCallback) keepAliveCallback();
      }, 10000);

      try {
        const i = input as Record<string, string>;
        const hookCtx = {
          chatId: msg.chatId,
          userId: msg.userId,
          channel: msg.channel,
          deps,
          historySize: history.length,
        };
      
        const hookRes = await hookRegistry.runPreToolUse(hookCtx, name, i);
        if (!hookRes.allowed) {
          return hookRes.reason ?? "Execution blocked by hook.";
        }

        return await baseToolHandler.execute(name, input);
      } finally {
        clearInterval(pingInterval);
      }
    }
  };

  // ─── Load soul/user/memory files ────────────────────────────────────────────
  const dataDir = path.dirname(config.dbPath);

  function safeRead(filePath: string): string {
    try { return fs.readFileSync(filePath, "utf8"); } catch { return ""; }
  }

  // Chỉ load 2000 ký tự đầu mỗi file để tránh system prompt quá nặng
  const safeReadTrimmed = (filePath: string, maxChars = 2000): string => {
    const content = safeRead(filePath);
    return content.length > maxChars ? content.slice(0, maxChars) + "\n...(truncated)" : content;
  };

  const soulContent = safeReadTrimmed(path.join(dataDir, "soul.md"), 800);
  const userContent = safeReadTrimmed(path.join(dataDir, "user.md"), 800);
  const memoryContent = safeReadTrimmed(path.join(dataDir, "memory.md"), 1200);

  const soulBlock = soulContent ? `\n<bot_soul>\n${soulContent}\n</bot_soul>` : "";
  const userBlock = userContent ? `\n<user_context>\n${userContent}\n</user_context>` : "";
  const memoryBlock = memoryContent ? `\n<working_memory>\n[MEMORY]\n${memoryContent}\n</working_memory>` : "";

  // Thay thế hardcoded dynamicContext bằng luồng SessionStart Hooks
  const hookCtx = {
    chatId: msg.chatId,
    userId: msg.userId,
    channel: msg.channel,
    deps,
    historySize: history.length,
  };
  const dynamicContextText = await hookRegistry.runSessionStart(hookCtx);
  const dynamicContext = dynamicContextText ? `\n<dynamic_context>\n${dynamicContextText}\n</dynamic_context>` : "";

  // ─── Model routing — tự chọn model theo độ phức tạp ─────────────────────
  const complexity = classifyComplexity(msg.text, history);
  const selectedModel = selectModel(complexity, config.model);
  console.log(`[router] complexity=${complexity} model=${selectedModel} msg="${msg.text.slice(0, 40)}..."`);

  const dynamicSystemPrompt = config.systemPrompt + soulBlock + userBlock + memoryBlock + dynamicContext;

  // Begin streaming — tự động retry khi server overloaded (529)
  let overloadAttempt = 0;
  const MAX_OVERLOAD_RETRIES = 3;
  let fullText = "";
  let finalAssistantMessages: any[] | undefined = undefined;

  // Luôn lưu ngay user turn vào CSDL trước khi xử lý, để chống mất ngữ cảnh khi API trả lỗi giữa chừng
  if (!opts.noHistory) {
    sessionManager.appendUserTurn(sessionKey, msg.text);
  }

  try {
    while (true) {
      const streamHandle = channel.beginStream?.(msg.chatId);
      fullText = "";

      // Áp dụng Idle Timeout (300s): Nới lỏng thời gian cho model vì file context bây giờ quá khổng lồ (250k tokens)
      const loopController = new AbortController();
      let enforceTimeout = setTimeout(() => { loopController.abort(new Error("Timeout_Google_API")); }, 300000);

      const resetIdleTimeout = () => {
        clearTimeout(enforceTimeout);
        enforceTimeout = setTimeout(() => { loopController.abort(new Error("Timeout_Google_API")); }, 300000);
      };
      keepAliveCallback = resetIdleTimeout;

      try {
        for await (const event of aiClient.stream({
          history,
          userMessage: msg.text,
          imageBase64,
          imageMimeType,
          model: selectedModel,
          maxTokens: config.maxTokens,
          thinkingBudgetTokens: complexity === "complex" ? config.thinkingBudgetTokens : undefined,
          systemPrompt: dynamicSystemPrompt,
          signal: loopController.signal,
          toolHandler,
        })) {
          // Bắt lỗi Abort do timeout nếu SDK ngâm không chịu nhả error event ngay
          if (loopController.signal.aborted && event.type !== "error") {
             throw new Error("Timeout_Google_API");
          }

          if (event.type === "delta" || event.type === "heartbeat") {
            resetIdleTimeout(); // Cứ mỗi khi có chữ là gia hạn sự sống!
            if (event.type === "delta") {
              fullText = event.fullText ?? fullText;
              streamHandle?.update(fullText);
            }
          } else if (event.type === "done") {
            fullText = event.fullText ?? fullText;
            finalAssistantMessages = event.assistantMessages;
          } else if (event.type === "error") {
            throw event.error;
          }
        }

        if (controller.signal.aborted) {
          await streamHandle?.abort();
          return;
        }

        await streamHandle?.finalize();
        break; // thành công

      } catch (err) {
        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.toLowerCase().includes("abort") || err.name === "APIUserAbortError" || err.message.includes("Timeout_Google_API"));

        if (isAbort) {
          await streamHandle?.abort();
          await channel.send({
            channel: msg.channel,
            chatId: msg.chatId,
            text: "⚠️ Trí tuệ Gemma 4 đã tịt ngòi 300 giây (Chạm mốc Idle Timeout). Chắc do file context bạn gửi quá khổng lồ khiến AI mất hơn 5 phút chỉ để đọc! Đã tự động ngắt kết nối an toàn.",
            isFinal: true,
          });
          return;
        }

        console.error("[pipeline] AI error:", err);
        await streamHandle?.abort();

        const isOverloaded =
          err instanceof Error && (
            err.message.includes("overloaded_error") ||
            err.message.toLowerCase().includes("overloaded") ||
            (err as any).status === 529
          );

        if (isOverloaded && overloadAttempt < MAX_OVERLOAD_RETRIES) {
          overloadAttempt++;
          const delayMs = overloadAttempt * 5000;
          console.warn(`[pipeline] Overloaded, retry ${overloadAttempt}/${MAX_OVERLOAD_RETRIES} in ${delayMs / 1000}s`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        await channel.send({
          channel: msg.channel,
          chatId: msg.chatId,
          text: isOverloaded
            ? "Server API đang quá tải hoặc gặp giới hạn, vui lòng thử lại sau ít phút."
            : `[Lỗi API]: ${err instanceof Error ? err.message : String(err)}`,
          isFinal: true,
        });
        return;
      } finally {
        clearTimeout(enforceTimeout);
      }
    }
  } finally {
    deregisterStream(msg.chatId);
    if (progressMsgId && channel.id === "telegram") {
      try { await (channel as any).bot.api.deleteMessage(msg.chatId, Number(progressMsgId)); } catch {}
    }

    // Lưu lại đoạn hội thoại partial/final của bot vào lịch sử để Bot nhớ nó đã làm gì trước khi bị tắt ngang.
    if (!opts.noHistory) {
      if (finalAssistantMessages && finalAssistantMessages.length > 0) {
        for (const message of finalAssistantMessages) {
          if (message.role === "assistant" || message.role === "tool") {
            sessionManager.appendFullTurn(sessionKey, message);
          }
        }
      } else if (fullText) {
        sessionManager.appendAssistantTurn(sessionKey, fullText);
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shouldRequireApproval(command: string, mode: Config["bashApprovalMode"]): boolean {
  if (mode === "never") return false;
  if (mode === "always") return true;
  // "smart": chỉ hỏi khi lệnh có pattern nguy hiểm
  return isDangerous(command);
}

