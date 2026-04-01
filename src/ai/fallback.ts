import type { AIClient, AIRequest, AIStreamEvent } from "./types.js";
import { AnthropicClient } from "./client.js";

export class FallbackClient implements AIClient {
  constructor(private primary: AIClient, private fallbacks: { client: AIClient; defaultModel: string }[]) {}

  async *stream(req: AIRequest): AsyncGenerator<AIStreamEvent> {
    const attempts = [{ client: this.primary, model: req.model }, ...this.fallbacks.map(f => ({ client: f.client, model: f.defaultModel }))];
    
    for (let i = 0; i < attempts.length; i++) {
      const { client, model } = attempts[i];
      const scopedReq = { ...req, model, _retried: i > 0 };
      
      try {
        let streamStarted = false;
        for await (const event of client.stream(scopedReq)) {
          if (event.type === "delta" && event.delta) {
             streamStarted = true;
          }
          yield event;
        }
        
        // Hoàn thành thành công, break vòng lặp fallback
        return;
      } catch (err: any) {
        const isAborted = err.name === "AbortError" || err.message?.includes("abort");
        if (isAborted) {
          throw err;
        }

        console.warn(`[fallback] Provider attempt ${i + 1} failed with model ${model}. Error: ${err.message}`);
        
        if (i < attempts.length - 1) {
          const nextModel = attempts[i + 1].model;
          console.warn(`[fallback] Switching to fallback provider with model: ${nextModel}`);
          yield { type: "delta", delta: `\n\n_[Hệ thống: API ${model} bị lỗi, đang tự động chuyển sang ${nextModel}...]_ \n\n` };
          continue;
        }
        
        // Hết fallback thì throw
        throw err;
      }
    }
  }
}
