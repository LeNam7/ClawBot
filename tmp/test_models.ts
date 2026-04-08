import fs from "fs";

async function main() {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/models", {
    headers: {
      "Authorization": "Bearer AIzaSyBHVp94VNpbGympJb34EdbBlL8Oeic40Lc"
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
