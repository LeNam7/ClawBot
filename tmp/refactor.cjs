const fs = require('fs');
const path = require('path');

const file = path.resolve('src/pipeline/handler.ts');
let lines = fs.readFileSync(file, 'utf-8').split('\n');

// 1. Remove imports
const toRemove = [
  'import { loader, ensureLoaded }',
  'import { fetchUrl }',
  'import { webSearch, executeGlob, executeGrep }',
  'import { searchMemory }',
  'import { readFile, writeFile, listDir }',
  'import { taskManager }',
  'import { runBash }'
];
lines = lines.filter(l => !toRemove.some(tr => l.includes(tr)));

// 2. Add new SkillManager initialization
const firstImport = lines.findIndex(l => l.startsWith('import '));
lines.splice(firstImport + 1, 0, 
  'import { SkillManager } from "../skills/manager.js";',
  'const skillManager = new SkillManager(process.cwd());',
  'let skillsLoaded = false;',
  'export async function ensureSkillsLoaded() {',
  '  if (!skillsLoaded) { await skillManager.loadSkills(); skillsLoaded = true; }',
  '}'
);

// 3. Remove TOOLS array
const toolsStart = lines.findIndex(l => l.startsWith('const TOOLS: ToolDefinition[] = ['));
const toolsEnd = lines.findIndex((l, i) => i > toolsStart && l.startsWith('];'));
if (toolsStart !== -1 && toolsEnd !== -1) {
  lines.splice(toolsStart, toolsEnd - toolsStart + 1, '// Tools dynamically loaded via SkillManager');
}

// 4. Update ensureLoaded() -> ensureSkillsLoaded()
const ensureIdx = lines.findIndex(l => l.includes('await ensureLoaded();'));
if (ensureIdx !== -1) {
  lines[ensureIdx] = '  await ensureSkillsLoaded();';
}

// 5. Replace toolHandler block
const executorStart = lines.findIndex(l => l.includes('const toolHandler: ToolHandler = {'));
const blockEnd1 = lines.findIndex((l, i) => i > executorStart && l.trim() === '},' && lines[i+1] && lines[i+1].trim() === '};');
if (executorStart !== -1 && blockEnd1 !== -1) {
  const newBlock = `  const skContext = { msg, sendProgress };
  const baseToolHandler = skillManager.createToolHandler(deps, skContext);
  
  const toolHandler: ToolHandler = {
    tools: baseToolHandler.tools,
    execute: async (name, input): Promise<string> => {
      const pingInterval = setInterval(() => {
        if (keepAliveCallback) keepAliveCallback();
      }, 10000);

      try {
        const i = input as Record<string, string>;
        const hookCtx = {
          chatId: msg.chatId,
          userId: msg.userId,
          channel: msg.channel,
          deps,
          historySize: history.length,
        };
      
        const hookRes = await hookRegistry.runPreToolUse(hookCtx, name, i);
        if (!hookRes.allowed) {
          return hookRes.reason ?? "Execution blocked by hook.";
        }

        return await baseToolHandler.execute(name, input);
      } finally {
        clearInterval(pingInterval);
      }
    }
  };`;
  lines.splice(executorStart, blockEnd1 - executorStart + 2, newBlock);
}

// 6. Delete buildExportMarkdown Helper
const exportStart = lines.findIndex(l => l.startsWith('function buildExportMarkdown'));
const exportEnd = lines.findIndex((l, i) => i > exportStart && l.startsWith('}'));
if (exportStart !== -1 && exportEnd !== -1) {
  lines.splice(exportStart, exportEnd - exportStart + 1);
}

fs.writeFileSync(file, lines.join('\n'));
console.log('Refactor complete check file size.');
