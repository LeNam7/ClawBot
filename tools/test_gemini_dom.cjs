const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const userDataDir = path.resolve(process.env.USERPROFILE, "AppData", "Local", "Google", "Chrome", "User Data");
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--profile-directory=Default"]
  });

  const page = await browser.newPage();
  await page.goto('https://gemini.google.com/');
  
  await page.waitForSelector('rich-textarea, div[role="textbox"]');
  await page.evaluate(() => {
     const input = document.querySelector('rich-textarea, div[role="textbox"]');
     input.innerHTML = '<p>What is 3982 * 123? Think step by step.</p>';
  });
  
  await page.evaluate(() => {
     document.querySelector('rich-textarea, div[role="textbox"]').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
  });
  
  console.log("Waiting for generation...");
  await page.waitForTimeout(20000);
  
  const html = await page.evaluate(() => {
     const responses = document.querySelectorAll('message-content, .message-content, [data-test-id="message-content"]');
     if (responses.length === 0) return document.body.innerHTML.substring(0, 5000);
     return responses[responses.length - 1].outerHTML;
  });
  
  const fs = require('fs');
  fs.writeFileSync('C:\\Users\\PC\\clawbot\\gemini_dom.txt', html);
  console.log("DOM saved to gemini_dom.txt");
  
  await browser.close();
})();
