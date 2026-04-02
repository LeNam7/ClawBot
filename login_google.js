import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, 'data', 'browser_profile');

console.log('Đang gọi trình duyệt CHROME lên với chế độ Bypass Bot Detection...');
console.log('============ LƯU Ý =============');
console.log('Google quá thông minh nên đã nhận diện Bot.');
console.log('Lần này tôi đã bật khiên tàng hình chống phát hiện Bot.');
console.log('Nếu vẫn bị chặn, MẸO LÀ: Hãy vào https://stackoverflow.com/users/login -> Bấm Đăng Nhập Bằng Google -> Rồi mới vào lại Gemini!');
console.log('================================');

(async () => {
  try {
    const context = await chromium.launchPersistentContext(dataDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
      ignoreDefaultArgs: ['--enable-automation'], // Tắt cờ automation để Google không phát hiện
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
      ],
    });

    // Ép navigator.webdriver = false ở mọi tab được mở ra
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    await page.goto('https://gemini.google.com/app');

    context.on('close', () => {
      console.log('Đã lưu phiên đăng nhập Google bằng Chrome!');
      process.exit(0);
    });
  } catch (error) {
    console.error('Không thể mở trình duyệt, lỗi:', error.message);
    process.exit(1);
  }
})();
