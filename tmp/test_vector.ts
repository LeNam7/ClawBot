import { searchMemory } from "../src/memory/search.js";
import path from "path";

async function main() {
  const memDir = path.resolve("./data/memories");
  console.log("Testing memory search in:", memDir);
  const result = await searchMemory("thử nghiệm chạy", memDir);
  console.log("--- RESULT ---");
  console.log(result);
}

main().catch(console.error);
