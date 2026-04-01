import fs from "node:fs";
import path from "node:path";
import { getEmbedding, cosineSimilarity } from "./vector.js";

const MAX_RESULTS = 3;
const SIMILARITY_THRESHOLD = 0.3; // ngưỡng chấp nhận mức độ giống nhau (trên 30%)

interface VectorCache {
  [filename: string]: {
    mtime: number;
    chunks: { text: string; embedding: number[] }[];
  };
}

let cache: VectorCache | null = null;

// Tách đoạn văn bản vừa phải để tạo vector được chính xác thay vì nhét nguyên file vào.
function chunkText(text: string): string[] {
  const rawChunks = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";
  
  for (const c of rawChunks) {
    if ((currentChunk.length + c.length) > 1000) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = c;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + c;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks.filter(c => c.length > 20); // bỏ chunk quá ngắn
}

/**
 * Tìm kiếm theo dạng Semantic Search Vector.
 * Lần đầu chạy sẽ quét toàn bộ thư mục memories (nếu chưa có cache index)
 */
export async function searchMemory(query: string, memoriesDir: string): Promise<string> {
  if (!fs.existsSync(memoriesDir)) {
    return "Chưa có memory nào được lưu.";
  }

  const files = fs.readdirSync(memoriesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // Ưu tiên xếp cái mới nhất lúc đọc ra

  if (files.length === 0) {
    return "Chưa có memory nào được lưu.";
  }

  const indexPath = path.join(memoriesDir, "vector_index.json");
  
  // 1. Tải cache
  if (!cache) {
    if (fs.existsSync(indexPath)) {
      try { 
        cache = JSON.parse(fs.readFileSync(indexPath, "utf8")); 
      } catch { 
        cache = {}; 
      }
    } else { 
      cache = {}; 
    }
  }

  let updatedIdx = false;
  const currentFiles = new Set(files);

  // 2. Vectorize những file mới hoặc bị chỉnh sửa
  for (const file of files) {
    const filePath = path.join(memoriesDir, file);
    let mtime: number;
    try {
      mtime = fs.statSync(filePath).mtimeMs;
    } catch { continue; }
    
    // Nếu chưa có trong cache hoặc file đã thay đổi -> tạo lại index file đó.
    if (!cache![file] || cache![file].mtime < mtime) {
      let content = "";
      try { content = fs.readFileSync(filePath, "utf8"); } catch { continue; }
      
      const chunksStr = chunkText(content);
      const chunks = [];
      for (const text of chunksStr) {
        try {
          const embedding = await getEmbedding(text);
          if (embedding.length > 0) chunks.push({ text, embedding });
        } catch (e) {
          console.error(`Lỗi trích xuất (Embedding) chunk:`, e);
        }
      }
      cache![file] = { mtime, chunks };
      updatedIdx = true;
    }
  }

  // 3. Xoá rác file dư thừa khỏi cache để giảm RAM
  for (const knownFile of Object.keys(cache!)) {
    if (!currentFiles.has(knownFile)) {
      delete cache![knownFile];
      updatedIdx = true;
    }
  }

  if (updatedIdx) {
    fs.writeFileSync(indexPath, JSON.stringify(cache));
  }

  // 4. Nhúng ngữ nghĩa trên Câu Hỏi
  let queryEmbedding: number[];
  try {
    queryEmbedding = await getEmbedding(query);
  } catch (err) {
    return "Lỗi bộ nhớ AI nhúng: Không thể nhúng câu truy vấn hiện tại để lấy vector đối chiếu.";
  }

  // 5. Tìm kiếm (Cosine Similarity Loop)
  const results: { filename: string; text: string; score: number }[] = [];
  
  for (const [filename, fileData] of Object.entries(cache!)) {
    for (const chunk of fileData.chunks) {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= SIMILARITY_THRESHOLD) {
        results.push({ filename, text: chunk.text, score });
      }
    }
  }

  if (results.length === 0) {
    return `Không có ký ức (memory) nào khớp đủ độ đo ngữ nghĩa (>${Math.round(SIMILARITY_THRESHOLD * 100)}%) với: "${query}"`;
  }

  // Sort giảm dần điểm tương đồng Cosine
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, MAX_RESULTS);

  const lines = [`[Vector DB] Tìm thấy ${topResults.length}/${results.length} ký ức phù hợp với ngữ nghĩa: "${query}"\n`];
  
  for (const r of topResults) {
    const dateMatch = r.filename.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : r.filename;
    lines.push(`**[${date}]** (${r.filename}) - (Độ tương đồng: ${Math.round(r.score * 100)}%)`);
    lines.push(r.text);
    lines.push("---");
  }

  return lines.join("\n");
}
