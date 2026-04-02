import { chromium, BrowserContext, Page } from 'playwright';
import path from 'node:path';

export class BrowserManager {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private dataDir: string;

  constructor(workspaceDir: string) {
    this.dataDir = path.join(path.dirname(workspaceDir), 'data', 'browser_profile');
  }

  async init(): Promise<void> {
    if (this.context) return;
    
    console.log('[browser] initializing persistent context...');
    try {
      this.context = await chromium.launchPersistentContext(this.dataDir, {
        headless: true,
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });

      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
      
      // Hook up basic error logging
      this.page.on('pageerror', err => {
        console.error('[browser] page error:', err.message);
      });
      
      console.log('[browser] initialized successfully');
    } catch (err) {
      console.error('[browser] failed to initialize:', err);
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      console.log('[browser] closing persistent context...');
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }

  async executeAction(action: string, target?: string, value?: string): Promise<string | Buffer> {
    await this.init();
    if (!this.page) throw new Error("Browser page not initialized");

    const p = this.page;

    try {
      switch (action) {
        case "goto": {
          if (!target) return "Missing URL target";
          
          // --- Bắt đầu bảo mật ---
          let parsed: URL;
          try {
            parsed = new URL(target);
          } catch {
            return `Lỗi bảo mật: Cú pháp URL không hợp lệ "${target}"`;
          }

          if (!["http:", "https:"].includes(parsed.protocol)) {
            return `Lỗi bảo mật: Trình duyệt chỉ được duyệt Protocol Web (http/https). Protocol Cục bộ hay File bị cấm tuyệt đối.`;
          }

          const host = parsed.hostname.toLowerCase();
          const isPrivateIp = 
            host === "localhost" || 
            host === "127.0.0.1" || 
            host === "0.0.0.0" ||
            host === "::1" ||
            host.startsWith("192.168.") || 
            host.startsWith("10.") || 
            host.startsWith("169.254.") || 
            host.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);

          if (isPrivateIp) {
            return `Lỗi bảo mật: Trình duyệt phát hiện AI nhắm đến IP nội bộ. Lệnh bị phong tỏa tức khắc.`;
          }
          // --- Kết thúc bảo mật ---

          await p.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
          return `Navigated to ${target}. Current title: ${await p.title()}`;
        }
        case "click":
          if (!target) return "Missing CSS selector target";
          await p.waitForSelector(target, { state: 'visible', timeout: 10000 });
          await p.click(target);
          await p.waitForLoadState('networkidle').catch(() => {}); // Wait for any potential navigation
          return `Clicked element: ${target}`;
          
        case "type":
          if (!target) return "Missing CSS selector target";
          if (!value) return "Missing text value to type";
          await p.waitForSelector(target, { state: 'visible', timeout: 10000 });
          await p.fill(target, value);
          return `Typed "${value}" into ${target}`;
          
        case "scroll": {
           const dir = value || target || 'down';
           await p.evaluate((d) => {
              if (d === 'down') window.scrollBy(0, window.innerHeight * 0.8);
              else if (d === 'up') window.scrollBy(0, -window.innerHeight * 0.8);
              else if (d === 'bottom') window.scrollTo(0, document.body.scrollHeight);
              else if (d === 'top') window.scrollTo(0, 0);
              else window.scrollBy(0, parseInt(d, 10) || 500);
           }, dir);
           // Wait a brief moment for scroll-triggered DOM updates (like lazy loading)
           await p.waitForTimeout(500);
           return `Scrolled ${dir}`;
        }

        case "extract_text": {
          // Bóc tách text thông minh bằng innerText, giới hạn trả về
          const text = await p.evaluate(() => document.body.innerText);
          // 40000 ký tự rơi vào khoảng khoảng 10-15k tokens
          return text.length > 40000 
            ? text.slice(0, 40000) + "\n...[Text truncated due to length limits]" 
            : text || "[No text found on page]";
        }
          
        case "screenshot": {
          const buffer = await p.screenshot({ type: "jpeg", quality: 80, fullPage: false });
          return buffer;
        }

        case "element_screenshot": {
          if (!target) return "Missing CSS selector target";
          const el = await p.waitForSelector(target, { state: 'visible', timeout: 10000 });
          if (!el) return "Element not found";
          const buffer = await el.screenshot({ type: "jpeg", quality: 90 });
          return buffer;
        }

        case "evaluate": {
          if (!target) return "Missing JavaScript code in target";
          const result = await p.evaluate(target);
          if (typeof result === "object") return JSON.stringify(result);
          return String(result);
        }

        default:
          return `Unknown browser action: ${action}. Allowed: goto, click, type, scroll, extract_text, screenshot, element_screenshot, evaluate.`;
      }
    } catch (err: any) {
      return `Browser action failed: ${err.message}`;
    }
  }
}
