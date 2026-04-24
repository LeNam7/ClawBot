const fs = require('fs');
const path = require('path');

const dirs = fs.readdirSync('src/skills', {withFileTypes: true}).filter(d => d.isDirectory());
for (const d of dirs) {
  const p = path.join('src/skills', d.name, 'index.ts');
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/from \'\.\.\//g, "from '../../");
  content = content.replace(/from \"\.\.\//g, 'from "../../');
  content = content.replace(/from \'\.\/manager\.js\'/g, "from '../manager.js'");
  content = content.replace(/from \"\.\/manager\.js\"/g, 'from "../manager.js"');
  fs.writeFileSync(p, content, 'utf8');
  console.log('Fixed ' + d.name);
}
