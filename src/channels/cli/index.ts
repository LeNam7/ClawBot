import * as readline from "node:readline";
import type { IChannel, StreamHandle } from "../types.js";
import type { InboundMessage, OutboundMessage } from "../../core/types.js";
import { resolveApproval } from "../../pipeline/approval.js";
import type { SecurityManager } from "../../core/security.js";

class CLIStreamSender implements StreamHandle {
  private printedLen = 0;

  constructor(private prefix: string) {
    process.stdout.write(this.prefix);
  }

  update(fullText: string): void {
    const newText = fullText.slice(this.printedLen);
    if (newText) {
      process.stdout.write(newText);
      this.printedLen = fullText.length;
    }
  }

  async finalize(): Promise<void> {
    process.stdout.write("\n\n");
  }

  async abort(): Promise<void> {
    process.stdout.write(" [Bị huỷ]\n\n");
  }
}

export class CLIChannel implements IChannel {
  readonly id = "cli";
  onMessage: ((msg: InboundMessage) => Promise<void>) | null = null;
  private rl: readline.Interface | null = null;

  constructor(private security: SecurityManager) {}

  async start(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "🧑 Bạn: "
    });

    console.log("\n💬 Kênh Local CLI đã sẵn sàng! Gõ tin nhắn để chat với Bot.");
    
    // Yêu cầu prompt ngay khi bắt đầu
    setTimeout(() => this.rl?.prompt(), 100);

    this.rl.on("line", async (line) => {
      const text = line.trim();
      if (!text) {
        this.rl?.prompt();
        return;
      }

      // Xử lý admin approval bypass bằng CLI
      if (text.startsWith("y ") || text === "y" || text.startsWith("n ") || text === "n") {
        // Trong môi trường CLI, chúng ta giả định admin ngồi máy host có thể thao tác phê duyệt dễ dàng
        // Tuy nhiên approval logic đang bị ẩn sau approvalId. Để đơn giản, CLI không dùng click.
        // Để demo, chúng ta bỏ qua việc catch y/n ở đây.
      }

      // Check security
      const access = this.security.checkAccess("local-cli-admin", text);
      if (!access.isAllowed) {
        console.log(`🤖 Bot: ${access.message}`);
        this.rl?.prompt();
        return;
      }
      if (access.isNewlyPaired) {
        console.log(`🤖 Bot: ${access.message}`);
        this.rl?.prompt();
        return;
      }

      const inbound: InboundMessage = {
        id: `cli:admin:${Date.now()}`,
        channel: this.id,
        userId: "local-cli-admin",
        chatId: "cli-chat",
        text,
        receivedAt: new Date().toISOString(),
        raw: null,
      };

      try {
        await this.onMessage?.(inbound);
      } catch (err) {
        console.error("[cli] Lỗi xử lý tin nhắn:", err);
      }
      
      this.rl?.prompt();
    });
  }

  async stop(): Promise<void> {
    this.rl?.close();
    console.log("[cli] Đã đóng kênh Terminal.");
  }

  async send(msg: OutboundMessage): Promise<string | undefined> {
    console.log(`\n🤖 Bot: ${msg.text}\n`);
    this.rl?.prompt();
    return String(Date.now());
  }

  beginStream(chatId: string): StreamHandle {
    return new CLIStreamSender("\n🤖 Bot: ");
  }
}
