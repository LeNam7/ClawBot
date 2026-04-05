import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
  try {
    const res = await client.chat.completions.create({
      model: "gemma-4-31b-it",
      messages: [
        { role: "user", content: "hello" },
        { 
          role: "assistant", 
          content: "<thought>Testing</thought>", 
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "get_weather", arguments: "{" } }
          ] 
        },
        {
          role: "tool",
          tool_call_id: "call_1",
          content: "Sunny"
        }
      ],
      tools: [
        { type: "function", function: { name: "get_weather", description: "Get weather" } }
      ]
    });
    console.log("Success:", res.choices[0].message.content);
  } catch (e: any) {
    console.error("API Error:");
    console.error(e.status, e.message);
    if (e.response && e.response.data) {
        console.error(e.response.data);
    }
  }
}
run();
