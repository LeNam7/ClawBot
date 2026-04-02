// File I/O tools — read_file, write_file, list_dir
// Tất cả đều bị sandbox trong WORKSPACE_DIR để tránh AI truy cập file hệ thống

import fs from "node:fs";
import path from "node:path";

const MAX_READ_SIZE = 50_000; // chars — tránh trả quá nhiều vào context

/**
 * Resolve đường dẫn an toàn trong workspace.
 * Throws nếu path cố thoát ra ngoài workspace (path traversal).
 */
function safePath(workspaceDir: string, filePath: string): string {
  const workspace = path.resolve(workspaceDir);
  const resolved = path.resolve(workspace, filePath);

  if (!resolved.startsWith(workspace + path.sep) && resolved !== workspace) {
    throw new Error(
      `Truy cập bị từ chối: đường dẫn "${filePath}" nằm ngoài workspace.`
    );
  }

  // Follow symlinks và kiểm tra real path (tránh symlink traversal)
  try {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith(workspace + path.sep) && real !== workspace) {
      throw new Error(`Truy cập bị từ chối: symlink trỏ ra ngoài workspace.`);
    }
  } catch (e) {
    // ENOENT = file chưa tồn tại (cho write operations) — bỏ qua
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  return resolved;
}

// ─── Writers theo định dạng ────────────────────────────────────────────────

async function writeDocx(resolved: string, content: string): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");

  const lines = content.split("\n");
  const children: InstanceType<typeof Paragraph>[] = [];

  for (const line of lines) {
    if (line.startsWith("# ")) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith("### ")) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith("**") && line.endsWith("**")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2, -2), bold: true })],
      }));
    } else {
      children.push(new Paragraph({ text: line }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(resolved, buf);
}

async function writeXlsx(resolved: string, content: string): Promise<void> {
  const XLSX = await import("xlsx");

  // Hỗ trợ CSV hoặc JSON array
  let ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>;
  const trimmed = content.trim();

  if (trimmed.startsWith("[")) {
    // JSON array of objects
    const data = JSON.parse(trimmed) as Record<string, unknown>[];
    ws = XLSX.utils.json_to_sheet(data);
  } else {
    // CSV
    const rows = trimmed.split("\n").map((row) => row.split(",").map((c) => c.trim()));
    ws = XLSX.utils.aoa_to_sheet(rows);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  fs.writeFileSync(resolved, buf);
}

async function writePdf(resolved: string, content: string): Promise<void> {
  const PDFDocument = (await import("pdfkit")).default;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(resolved);
    doc.pipe(stream);

    // Dùng font hỗ trợ Unicode (built-in Helvetica cho ASCII)
    doc.font("Helvetica");

    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("# ")) {
        doc.fontSize(20).text(line.slice(2), { paragraphGap: 8 });
        doc.fontSize(12);
      } else if (line.startsWith("## ")) {
        doc.fontSize(16).text(line.slice(3), { paragraphGap: 6 });
        doc.fontSize(12);
      } else if (line.startsWith("### ")) {
        doc.fontSize(14).text(line.slice(4), { paragraphGap: 4 });
        doc.fontSize(12);
      } else if (line === "") {
        doc.moveDown(0.5);
      } else {
        doc.fontSize(12).text(line, { lineGap: 2 });
      }
    }

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Đọc nội dung file trong workspace.
 */
export function readFile(workspaceDir: string, filePath: string): string {
  let resolved: string;
  try {
    resolved = safePath(workspaceDir, filePath);
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }

  if (!fs.existsSync(resolved)) {
    return `File không tồn tại: ${filePath}`;
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return `"${filePath}" là thư mục, không phải file. Dùng list_dir để xem nội dung.`;
  }

  try {
    const content = fs.readFileSync(resolved, "utf8");
    if (content.length > MAX_READ_SIZE) {
      return content.slice(0, MAX_READ_SIZE) + `\n\n...(truncated — file dài ${content.length} chars, chỉ hiển thị ${MAX_READ_SIZE})`;
    }
    return content;
  } catch {
    return `File tồn tại nhưng không đọc được dưới dạng text (có thể là file binary).`;
  }
}

/**
 * Ghi nội dung vào file trong workspace. Tạo thư mục cha nếu chưa có.
 * Tự động chọn writer phù hợp theo đuôi file:
 *   .docx → Word document (hỗ trợ markdown heading: #, ##, ###)
 *   .xlsx → Excel (hỗ trợ CSV hoặc JSON array)
 *   .pdf  → PDF document (hỗ trợ markdown heading: #, ##, ###)
 *   khác  → text thuần (UTF-8)
 */
export async function writeFile(workspaceDir: string, filePath: string, content: string): Promise<string> {
  let resolved: string;
  try {
    resolved = safePath(workspaceDir, filePath);
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }

  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".docx") {
      await writeDocx(resolved, content);
      return `✅ Đã tạo file Word: ${filePath}`;
    }

    if (ext === ".xlsx" || ext === ".xls") {
      await writeXlsx(resolved, content);
      return `✅ Đã tạo file Excel: ${filePath}`;
    }

    if (ext === ".pdf") {
      await writePdf(resolved, content);
      return `✅ Đã tạo file PDF: ${filePath}`;
    }

    // Mặc định: text
    fs.writeFileSync(resolved, content, "utf8");
    const lines = content.split("\n").length;
    return `✅ Đã ghi file: ${filePath} (${lines} dòng, ${content.length} ký tự)`;

  } catch (err) {
    return `Lỗi tạo file: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Liệt kê nội dung thư mục trong workspace.
 */
export function listDir(workspaceDir: string, dirPath: string = "."): string {
  let resolved: string;
  try {
    resolved = safePath(workspaceDir, dirPath);
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }

  // Nếu workspace chưa tồn tại, tạo nó
  if (!fs.existsSync(resolved)) {
    if (dirPath === "." || dirPath === "") {
      fs.mkdirSync(resolved, { recursive: true });
      return `Workspace trống: ${workspaceDir}`;
    }
    return `Thư mục không tồn tại: ${dirPath}`;
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    if (entries.length === 0) return `Thư mục trống: ${dirPath}`;

    const lines = entries.map((e) => {
      if (e.isDirectory()) return `📁 ${e.name}/`;
      const size = fs.statSync(path.join(resolved, e.name)).size;
      const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`;
      return `📄 ${e.name} (${sizeStr})`;
    });

    return `📂 ${dirPath}/\n${lines.join("\n")}`;
  } catch (err) {
    return `Lỗi đọc thư mục: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Sửa điểm nội dung file (Surgical Edit) bằng cách tìm kiếm chính xác đoạn text và thay thế.
 */
export function replaceInFile(workspaceDir: string, filePath: string, targetContent: string, replacementContent: string): string {
  let resolved: string;
  try {
    resolved = safePath(workspaceDir, filePath);
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }

  if (!fs.existsSync(resolved)) {
    return `File không tồn tại: ${filePath}`;
  }

  try {
    const text = fs.readFileSync(resolved, "utf8");
    if (!text.includes(targetContent)) {
      return `Lỗi: Không tìm thấy đoạn text mẫu (target_content) bên trong file. Hãy chắc chắn bạn đã copy chính xác từng khoảng trắng và ký tự xuống dòng của đoạn code cần sửa.`;
    }

    // Cảnh báo nếu đoạn text xuất hiện nhiều lần (chỉ thay thế lần đầu hoặc bắt AI cung cấp thêm context)
    const count = text.split(targetContent).length - 1;
    if (count > 1) {
      return `Lỗi: Đoạn text (target_content) xuất hiện ${count} lần trong file. Hãy copy nhiều dòng code hơn (mở rộng lên xuống khoảng 3-5 dòng) để đảm bảo đoạn text bạn muốn sửa là DUY NHẤT.`;
    }

    const newText = text.replace(targetContent, replacementContent);
    fs.writeFileSync(resolved, newText, "utf8");
    
    // Ghi nhận dòng bị thay đổi
    const linesChanged = replacementContent.split("\n").length - targetContent.split("\n").length;
    return `✅ Đã sửa file ${filePath} thành công (thay thế ${targetContent.length} ký tự thành ${replacementContent.length} ký tự, chênh lệch ${linesChanged} dòng).`;
  } catch (err) {
    return `Lỗi sửa file: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Thêm nội dung vào cuối file (chỉ dành cho file text/markdown).
 * Rất hữu ích cho tác vụ AI chunking.
 */
export function appendToFile(workspaceDir: string, filePath: string, content: string): string {
  let resolved: string;
  try {
    resolved = safePath(workspaceDir, filePath);
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }

  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    
    // Tự động xuống dòng nếu file đã tồn tại và nội dung mới không bắt đầu bằng dòng mới
    let dataToAppend = content;
    if (fs.existsSync(resolved)) {
       const stat = fs.statSync(resolved);
       if (stat.size > 0 && !dataToAppend.startsWith("\n")) {
         dataToAppend = "\n\n" + dataToAppend;
       }
    }
    
    fs.appendFileSync(resolved, dataToAppend, "utf8");
    return `✅ Đã append ${content.length} ký tự vào file ${filePath} thành công.`;
  } catch (err) {
    return `Lỗi append file: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Đọc nội dung file text/markdown (source) và biên dịch ra file đích (target) 
 * dưới các định dạng như .docx, .pdf, v.v.
 */
export async function compileFile(workspaceDir: string, sourcePath: string, targetPath: string): Promise<string> {
  let sourceResolved: string;
  let targetResolved: string;
  try {
    sourceResolved = safePath(workspaceDir, sourcePath);
    targetResolved = safePath(workspaceDir, targetPath);
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }

  if (!fs.existsSync(sourceResolved)) {
    return `Lỗi compile: File nguồn "${sourcePath}" không tồn tại.`;
  }
  
  try {
    const content = fs.readFileSync(sourceResolved, "utf8");
    fs.mkdirSync(path.dirname(targetResolved), { recursive: true });
    
    const ext = path.extname(targetPath).toLowerCase();
    
    if (ext === ".docx") {
      await writeDocx(targetResolved, content);
      return `✅ Compilation thành công! Đã bọc file markdown sang file Word: ${targetPath}`;
    }
    
    if (ext === ".xlsx" || ext === ".xls") {
      await writeXlsx(targetResolved, content);
      return `✅ Compilation thành công! Đã chuyển đổi dữ liệu sang file Excel: ${targetPath}`;
    }
    
    if (ext === ".pdf") {
      await writePdf(targetResolved, content);
      return `✅ Compilation thành công! Đã build file PDF: ${targetPath}`;
    }
    
    return `Lỗi compile: Không hỗ trợ định dạng đích "${ext}". Vui lòng dùng .docx, .xlsx hoặc .pdf.`;
  } catch (err) {
    return `Lỗi biên dịch file: ${err instanceof Error ? err.message : String(err)}`;
  }
}

