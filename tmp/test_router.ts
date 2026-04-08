import { classifyComplexity, selectModel } from "../src/ai/router.js";

const testCases = [
  "hi",
  "bạn khỏe không",
  "giải thích thuật toán dijkstra",
  "viết toàn bộ project và tất cả các bước để triển khai hệ thống kiến trúc microservices với cày cuốc qua 5 file nhé"
];

for (const msg of testCases) {
  const complexity = classifyComplexity(msg, []);
  const model = selectModel(complexity, "gemma-4-31b-it");
  console.log(`Msg: "${msg.slice(0, 20)}..." | Complex: ${complexity} | Model: ${model}`);
}
