import { mcpManager } from "./src/plugins/mcp_client.js";

async function test() {
  console.log("Connecting to MCP...");
  const timer = setTimeout(() => {
    console.log("TIMEOUT! MCP is blocking.");
    process.exit(1);
  }, 15000);
  
  await mcpManager.connect();
  console.log("Connected!");
  
  await mcpManager.fetchTools();
  console.log("Tools fetched:", mcpManager.getToolsSync().length);
  
  clearTimeout(timer);
  process.exit(0);
}

test().catch(console.error);
