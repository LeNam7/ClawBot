import fs from "fs";

async function main() {
  const reqMsg = [
    { role: "user", content: "hi" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: { name: "test_tool", arguments: "{}" }
        }
      ]
    },
    { role: "tool", tool_call_id: "call_123", content: "result ok" }
  ];

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer AIzaSyBHVp94VNpbGympJb34EdbBlL8Oeic40Lc",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: reqMsg,
      tools: [
        {
          type: "function",
          function: {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object", properties: {} }
          }
        }
      ]
    })
  });
  
  const body = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", body);
}

main().catch(console.error);
