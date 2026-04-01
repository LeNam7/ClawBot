import { pipeline, env } from "@xenova/transformers";

// Settings for Node.js
env.allowLocalModels = false;
env.useBrowserCache = false;

let extractor: any = null;

/**
 * Lấy embedding vector cho một đoạn văn bản (để đo lường ngữ nghĩa)
 * Lần chạy đầu tiên sẽ tự động tải model MiniLM L6 v2 từ HuggingFace (khoảng ~22MB)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) return [];
  if (!extractor) {
    // Pipeline feature-extraction sẽ chuyển text thành mã mảng
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Tính toán độ tương đồng Cosine (Cosine Similarity)
 * Trả về thang điểm từ -1 (hoàn toàn ngược) đến 1 (giống hệt nhau)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
