import type { AIClient } from "./types.js";
import { AnthropicClient } from "./client.js";
import { OpenAIClient } from "./openai-client.js";
import { FallbackClient } from "./fallback.js";

export type AIProvider = "anthropic" | "openai" | "ollama";

export interface AIProviderConfig {
  provider: AIProvider;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
}

/**
 * Tạo AIClient phù hợp dựa trên config provider. Có hỗ trợ Fallback tự động.
 */
export function createAIClient(cfg: AIProviderConfig): AIClient {
  switch (cfg.provider) {
    case "anthropic": {
      const primary = new AnthropicClient(cfg.anthropicApiKey ?? "auto");
      // Nếu có sẵn key OpenAI, thiết lập nó làm fallback mặc định (gpt-4o-mini)
      if (cfg.openaiApiKey) {
        const fallback = new OpenAIClient(cfg.openaiApiKey, cfg.openaiBaseUrl);
        return new FallbackClient(primary, [{ client: fallback, defaultModel: "gpt-4o-mini" }]);
      }
      return primary;
    }

    case "openai":
      return new OpenAIClient(cfg.openaiApiKey ?? "", cfg.openaiBaseUrl);

    case "ollama":
      // Ollama dùng OpenAI-compatible API, default port 11434
      return new OpenAIClient(
        cfg.openaiApiKey ?? "ollama",
        cfg.openaiBaseUrl ?? "http://localhost:11434/v1"
      );

    default:
      throw new Error(`Unknown AI provider: ${cfg.provider}`);
  }
}
