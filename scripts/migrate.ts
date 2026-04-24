import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillsDir = path.resolve(__dirname, '../src/skills');

async function migrate() {
  console.log(`Bắt đầu càn quét tại: ${skillsDir}`);
  const files = await fs.readdir(skillsDir);
  const skillFiles = files.filter(f => f.endsWith('.ts') && f !== 'manager.ts' && f !== 'types.ts');
  
  let successCount = 0;
  
  for (const file of skillFiles) {
    const filePath = path.join(skillsDir, file);
    const folderName = file.replace('.ts', '');
    const folderPath = path.join(skillsDir, folderName);
    
    try {
      // 1. Tạo folder
      await fs.mkdir(folderPath, { recursive: true });
      
      // 2. Chuyển file xyz.ts thành xyz/index.ts
      const newFilePath = path.join(folderPath, 'index.ts');
      
      // Chúng ta sẽ lấy description ra!
      // Không cần import (vì compliation complex), ta đọc chay Regex
      const code = await fs.readFile(filePath, 'utf8');
      
      // Cố gắng bắt chuỗi description
      // Regex này bắt description: "..." hoặc description: `...` hoặc '...'
      const descMatch = code.match(/description:\s*(["'`])([\s\S]*?)\1/);
      let descText = "Chưa có mô tả. Hãy cập nhật SKILL.md này để AI hiểu cách dùng công cụ.";
      
      if (descMatch && descMatch[2]) {
        descText = descMatch[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
      
      // 3. Ghi file SKILL.md
      const mdContent = `# Kỹ năng: ${folderName}\n\n## Hướng dẫn cho AI (Prompt Khóa)\n${descText}\n`;
      await fs.writeFile(path.join(folderPath, 'SKILL.md'), mdContent, 'utf8');
      
      // 4. Move file ts
      await fs.rename(filePath, newFilePath);
      console.log(`✅ Đã đóng gói: ${folderName}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Lỗi tại file ${file}:`, err);
    }
  }
  
  console.log(`\n🎉 Hoàn thành! Đã di dời thành công ${successCount} skills vào các Tàu Vũ Trụ siêu nhỏ.`);
}

migrate().catch(console.error);
