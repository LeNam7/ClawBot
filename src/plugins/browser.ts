import { BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright-extra';
// @ts-ignore
import stealth from 'puppeteer-extra-plugin-stealth';
import path from 'node:path';

chromium.use(stealth());

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
          
          if (host.includes("gemini")) {
            // Tự động triệt tiêu các popup phiền phức của Gemini (chướng ngại vật che màn hình)
            await p.evaluate(() => {
               const killPopups = () => {
                  document.querySelectorAll('mat-dialog-container, .mdc-dialog, [role="dialog"]').forEach(el => {
                     const btn = el.querySelector('button');
                     if (btn && btn.innerText.match(/không|bỏ qua|no|dismiss/i)) {
                        (btn as HTMLElement).click();
                     } else {
                        el.remove();
                     }
                  });
               };
               setTimeout(killPopups, 500);
               setTimeout(killPopups, 2000);
               setTimeout(killPopups, 5000);
            }).catch(() => {});
          }
          
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

        case "extract_gemini_thought": {
          const result = await p.evaluate(() => {
             // 1. Phân mảnh tin nhắn: Xác định khối trả lời cuối cùng mới nhất
             const messageBlocks = Array.from(document.querySelectorAll('message-content, .message-content, [data-test-id="message-content"]'));
             if (messageBlocks.length === 0) return "⚠️ Không tìm thấy phản hồi nào.";
             
             const lastBlock = messageBlocks[messageBlocks.length - 1];
             const parentContainer = lastBlock.closest('body') || document;
             
             // 2. Định vị Khối Tư Duy (Thought Process)
             // Gemini thường nhét tư duy vào thẻ <details> hoặc thẻ có class chứa từ "thought"
             let thoughtData = "";
             const detailBoxes = parentContainer.querySelectorAll('details, [class*="thought"], [data-test-id*="thought"]');
             
             // Chỉ xét các khối suy nghĩ nằm ở cụm tin nhắn cuối
             const lastDetailBox = detailBoxes.length > 0 ? detailBoxes[detailBoxes.length - 1] : null;
             
             if (lastDetailBox) {
                // Ép mở thẻ ẩn bằng code JS (Bỏ qua hiệu ứng hover)
                lastDetailBox.setAttribute('open', 'true');
                if (lastDetailBox.classList) lastDetailBox.classList.add('expanded');
                
                // Lấy thô toàn bộ nội tâm gạch xoá
                thoughtData = (lastDetailBox as HTMLElement).innerText.trim();
             }
             
             // 3. Định vị Khối Trả Lời Cuối Cùng (Final Output)
             const finalAnswer = (lastBlock as HTMLElement).innerText.trim();
             
             // 4. Lắp ráp và Đóng gói gửi về Telegram
             let outputStr = "";
             if (thoughtData && thoughtData.length > 10) {
                 outputStr += "💭 **[NỘI TÂM CỦA GEMINI]**\n";
                 outputStr += "```text\n" + thoughtData + "\n```\n\n";
                 outputStr += "===========================\n\n";
             }
             
             outputStr += "✅ **[CÂU TRẢ LỜI CHÍNH THỨC]**\n" + finalAnswer;
             return outputStr;
          });

          return result.length > 40000 
            ? result.slice(0, 40000) + "\n...[Đã cắt bớt do quá dài]" 
            : result;
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

        case "upload": {
          if (!target) return "Missing CSS selector target for <input type='file'>";
          if (!value) return "Missing file path value to upload";
          await p.waitForSelector(target, { state: 'attached', timeout: 10000 });
          await p.setInputFiles(target, value);
          return `Đã upload file thành công từ đường dẫn cục bộ: ${value}`;
        }

        case "evaluate": {
          if (!target) return "Missing JavaScript code in target";
          const result = await p.evaluate(target);
          if (typeof result === "object") return JSON.stringify(result);
          return String(result);
        }

        case "download": {
          if (!target) return "Missing CSS selector target for download button";
          // Đợi lên tới 60s cho tới khi cái nút xuất hiện trong DOM (dù nó bị ẩn tàng hình vẫn tính)
          await p.waitForSelector(target, { state: 'attached', timeout: 60000 });
          const downloadPromise = p.waitForEvent("download", { timeout: 60000 });
          
          // Dùng evaluate để ép click trực tiếp vào DOM (Bỏ qua việc phải di chuột Hover để làm nút hiện lên)
          await p.evaluate((sel) => {
             const elements = document.querySelectorAll(sel);
             if (elements.length === 0) throw new Error("Download button not found in DOM");
             // Nếu có nhiều nút tải, ưu tiên nút cuối cùng (thường là ảnh mới vẽ nhất)
             const btn = elements[elements.length - 1] as HTMLElement;
             btn.click();
          }, target);

          const download = await downloadPromise;
          const rs = await download.createReadStream();
          if (!rs) return "Failed to establish download stream.";
          
          const chunks: Buffer[] = [];
          for await (const chunk of rs) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          }
          return Buffer.concat(chunks);
        }

        case "extract_image": {
          if (!target) return "Missing CSS selector target for extract_image";
          await p.waitForSelector(target, { state: 'visible', timeout: 10000 });
          
          const imgSrc = await p.evaluate((sel) => {
             const img = document.querySelector(sel) as HTMLImageElement;
             if (!img || img.tagName.toLowerCase() !== 'img') throw new Error("Target must be an <img> tag");
             return img.src;
          }, target);
          
          if (!imgSrc) return "Failed to extract image source URL.";

          try {
             if (imgSrc.startsWith("data:image")) {
                const b64 = imgSrc.split(",")[1];
                if (!b64) throw new Error("Invalid data URI");
                return Buffer.from(b64, 'base64');
             }

             const response = await fetch(imgSrc);
             if (!response.ok) throw new Error("HTTP " + response.status);
             const arrayBuffer = await response.arrayBuffer();
             return Buffer.from(arrayBuffer);
          } catch (err: any) {
             return `Lỗi tải ảnh trực tiếp: ${err.message}. Gợi ý chiến thuật cho AI: Vì tính năng 'extract_image' bị chặn tải lén, bạn BẮT BUỘC HÃY chuyển sang dùng 'element_screenshot' và truyền đúng Selector lúc nãy vào tĩnh năng này để chụp cắt duy nhất cái khung tranh đó và gửi cho User nhé.`;
          }
        }

        default:
          return `Unknown browser action: ${action}. Allowed: goto, click, type, scroll, extract_text, screenshot, element_screenshot, evaluate, download, extract_image.`;
      }
    } catch (err: any) {
      return `Browser action failed: ${err.message}`;
    }
  }
}
