import OpenAI from "openai";
import type { AIClient, AIRequest, AIStreamEvent, ToolDefinition } from "./types.js";

/**
 * OpenAI-compatible client — hỗ trợ OpenAI API và Ollama (openai-compatible endpoint).
 * Ollama: đặt OPENAI_BASE_URL=http://localhost:11434/v1 và OPENAI_API_KEY=ollama
 */
export class OpenAIClient implements AIClient {
  private baseKeys: string[];
  private baseUrl?: string;
  private currentKeyIndex: number = 0;

  constructor(apiKey: string, baseUrl?: string) {
    this.baseKeys = apiKey ? apiKey.split(",").map(k => k.trim()).filter(Boolean) : ["ollama"];
    if (this.baseKeys.length === 0) this.baseKeys = ["ollama"];
    this.baseUrl = baseUrl;
  }

  private getClient(): OpenAI {
    return new OpenAI({
      apiKey: this.baseKeys[this.currentKeyIndex],
      baseURL: this.baseUrl,
    });
  }

  async *stream(req: AIRequest): AsyncGenerator<AIStreamEvent> {
    let fullText = "";

    try {
      let currentMessages = buildMessages(req);
      const tools = req.toolHandler?.tools.map(toOpenAITool) ?? [];
      const MAX_STEPS = 100; // Mở khóa sức mạnh trâu bò cho Autonomous Agent

      for (let step = 0; step < MAX_STEPS; step++) {
        const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
          model: req.model,
          max_tokens: req.maxTokens,
          messages: currentMessages as OpenAI.Chat.ChatCompletionMessageParam[],
          stream: true,
          ...(tools.length ? { tools, tool_choice: "auto" as const, parallel_tool_calls: false } : {}),
        };

        let stream;
        let attempt = 0;
        const MAX_RETRIES = this.baseKeys.length > 1 ? this.baseKeys.length * 2 : 5; // Rotate through all keys twice if needed
        while (attempt < MAX_RETRIES) {
          try {
            const client = this.getClient();
            stream = await client.chat.completions.create(params, {
              signal: req.signal,
            });
            break;
          } catch (err: any) {
            if (err.status === 429 || err?.message?.includes("429")) {
              attempt++;
              if (this.baseKeys.length > 1) {
                 // Rotate key immediately and retry
                 this.currentKeyIndex = (this.currentKeyIndex + 1) % this.baseKeys.length;
                 console.log(`[openai-client] Rate Limit 429. Rotating to key index ${this.currentKeyIndex} (Attempt ${attempt}/${MAX_RETRIES})`);
                 yield { type: "delta", delta: `\n\n_...Đang đổi API Key phụ (Lần ${attempt})..._\n`, fullText: fullText + `\n\n_...Đang đổi API Key phụ (Lần ${attempt})..._\n` };
                 // Nho wait môt chút cho chắc ăn
                 await new Promise(r => setTimeout(r, 1000));
              } else {
                 const backoff = attempt * 10000; // Đợi 10s, 20s, 30s...
                 console.log(`[openai-client] Bị chặn API Rate Limit 429. Chờ ${backoff/1000}s trước khi thử lại (Lần ${attempt}/${MAX_RETRIES})...`);
                 // Fix: Cập nhật fullText với thông báo chờ để UI hiển thị được
                 const tempFullText = fullText + `\n\n_...Đang chờ ${backoff/1000}s vì bị giới hạn API..._\n`;
                 yield { type: "delta", delta: `\n\n_...Đang chờ ${backoff/1000}s vì bị giới hạn API..._\n`, fullText: tempFullText };
                 await new Promise(r => setTimeout(r, backoff));
              }
            } else {
              throw err;
            }
          }
        }
        if (!stream) throw new Error("API failed after maximum retries due to 429 rate limit.");

        // Accumulate tool calls across chunks
        const toolCallsMap: Record<number, {
          id: string;
          name: string;
          arguments: string;
        }> = {};

        let finishReason: string | null = null;
        let stepText = "";

        for await (const chunk of stream) {
          // Emit heartbeat for EVERY chunk received to keep the idle timeout alive!
          yield { type: "heartbeat" };

          const choice = chunk.choices[0];
          if (!choice) continue;

          finishReason = choice.finish_reason ?? finishReason;
          const delta = choice.delta;

          // Stream text
          if (delta.content) {
            stepText += delta.content;
            fullText += delta.content;
            yield { type: "delta", delta: delta.content, fullText };
          }

          // Accumulate tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const actualIndex = tc.index ?? 0;
              
              if (!toolCallsMap[actualIndex]) {
                toolCallsMap[actualIndex] = { id: tc.id || `call_${actualIndex}`, name: "", arguments: "" };
              }

              let entry = toolCallsMap[actualIndex];

              // WORKAROUND cho thuật toán của Gemini/Ollama: 
              // Đôi khi hệ thống trả về nhiều tool call riêng biệt nhưng lại xài chung index = 0!
              // Nếu entry này ĐÃ CÓ arguments, mà giờ lại đẻ thêm tên hàm mới, tức là nó đang gửi 1 hàm mới hoàn toàn.
              if (tc.function?.name && entry.arguments.length > 0) {
                 const newIndex = Object.keys(toolCallsMap).length + 100; // Fake một index mới để cách ly
                 toolCallsMap[newIndex] = { id: tc.id || `call_${newIndex}`, name: "", arguments: "" };
                 entry = toolCallsMap[newIndex];
              }

              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name += tc.function.name;
              if (tc.function?.arguments) entry.arguments += tc.function.arguments;
            }
          }
        }

        const toolCalls = Object.values(toolCallsMap);

        // Handle tool calls (Google AI Studio returns "stop" instead of "tool_calls" in finish_reason so we explicitly check array length)
        console.log(`[step ${step}] fullText size:`, fullText.length, `toolCalls count:`, toolCalls.length);

        if (req.toolHandler && toolCalls.length > 0) {
          console.log(`[step ${step}] Executing ${toolCalls.length} tools...`);
          const toolResultMsgs: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

          for (const tc of toolCalls) {
            let input: unknown;
            try {
              input = JSON.parse(tc.arguments || "{}");
            } catch {
              input = {};
            }
            console.log(`[step ${step}] EXECUTING TOOL:`, tc.name);
            const result = await req.toolHandler.execute(tc.name, input);
            console.log(`[step ${step}] TOOL FINISHED. Result len:`, result.length);
            toolResultMsgs.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });
          }

          const assistantToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolCalls.map((tc, idx) => {
            let validArgs = tc.arguments;
            try {
              const parsed = JSON.parse(validArgs || "{}");
              let isCompressed = false;
              for (const key in parsed) {
                if (typeof parsed[key] === "string" && parsed[key].length > 2500) {
                  const originalLen = parsed[key].length;
                  parsed[key] = parsed[key].substring(0, 500) + 
                    `\n\n...[HỆ THỐNG ĐÃ NÉN: Đã cắt giảm ${originalLen - 1000} ký tự. Tool này đã ghi thành công vào ổ đĩa. Trút bỏ text này để chống tràn Context.]...\n\n` + 
                    parsed[key].slice(-500);
                  isCompressed = true;
                }
              }
              if (isCompressed) {
                validArgs = JSON.stringify(parsed);
                console.log(`[step ${step}] Compaction triggered on ${tc.name}! Argument string minimized.`);
              }
            } catch {
              validArgs = "{}";
            }
            return {
              id: tc.id || `call_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              type: "function" as const,
              function: { name: tc.name, arguments: validArgs },
            };
          });

          const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
            role: "assistant",
            content: stepText || null, // FIX 400 error schema requirements
            tool_calls: assistantToolCalls,
          };

          currentMessages = [
            ...currentMessages,
            assistantMsg,
            ...toolResultMsgs,
          ];
          
          console.log(`[step ${step}] Appended tools. currentMessages.length now:`, currentMessages.length);
          continue;
        } 
        
        // --- NẾU KHÔNG CÓ TOOL CALLS NÀO ĐƯỢC GỌI NỮA ---
        // Bỏ chế độ tự động BREAK vòng lặp ở đây. 
        // Cho phép Bot vừa sinh ra text, vừa gọi tool tiếp nếu nó muốn hoàn thành các bước tiếp theo.
        let visibleText = (stepText || "").replace(/<thought>[\s\S]*?<\/thought>/g, "");
          visibleText = visibleText.replace(/<thought>[\s\S]*$/g, "").trim();
          
          console.log(`[step ${step}] No tool calls. visibleText=`, visibleText === "" ? "EMPTY" : visibleText.substring(0,20));
          if (visibleText === "") {
             const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = { role: "assistant", content: stepText || "" };
             const systemNudge: OpenAI.Chat.ChatCompletionUserMessageParam = { 
               role: "user", 
               content: "[Hệ thống tự động nhắc nhở]: Bạn vừa phân tích trong thẻ thought nhưng lại QUÊN không gọi bất kỳ tool nào (ví dụ manage_tasks, write_file) hoặc quên trả lời cho tôi. BẮT BUỘC gọi tool ở định dạng JSON để tiến hành bước tiếp theo." 
             };
             currentMessages = [...currentMessages, assistantMsg, systemNudge];
             console.log(`[step ${step}] WATCHDOG TICKED! currentMessages.length now:`, currentMessages.length);
             continue;
          }
          
          // Trừ khi model thực sự nói "Xong/Hoàn tất" và không gọi tool nào thì vòng lặp mới được phép kết thúc tự nhiên.
          console.log(`[step ${step}] Breaking loop! AI has finalized response without extra tools.`);
          break;
      }

      const startIndex = req.systemPrompt ? req.history.length + 2 : req.history.length + 1;
      
      console.log(`[openai-client debug] Yielding done. currentMessages.length=${currentMessages.length}, startIndex=${startIndex}`);
      const assistantMessagesToYield = currentMessages.slice(startIndex) as any[];
      console.log(`[openai-client debug] assistantMessages sliced length=${assistantMessagesToYield.length}`);

      yield { 
        type: "done", 
        fullText,
        assistantMessages: assistantMessagesToYield
      };
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMessages(req: AIRequest): OpenAI.Chat.ChatCompletionMessageParam[] {
  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (req.systemPrompt) {
    msgs.push({ role: "system", content: req.systemPrompt });
  }

  for (const h of req.history) {
    if (h.role === "assistant") {
      msgs.push({ role: h.role, content: h.content, tool_calls: h.tool_calls as any });
    } else if (h.role === "tool") {
      msgs.push({ role: h.role, content: h.content, tool_call_id: h.tool_call_id as string });
    } else {
      msgs.push({ role: h.role as "user", content: h.content });
    }
  }

  if (req.imageBase64) {
    msgs.push({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:${req.imageMimeType ?? "image/jpeg"};base64,${req.imageBase64}`,
          },
        },
        { type: "text", text: req.userMessage },
      ],
    });
  } else {
    msgs.push({ role: "user", content: req.userMessage });
  }

  return msgs;
}

function toOpenAITool(t: ToolDefinition): OpenAI.Chat.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: t.input_schema.properties,
        required: t.input_schema.required ?? [],
      },
    },
  };
}
