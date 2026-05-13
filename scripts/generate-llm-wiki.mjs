import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WIKI = path.join(ROOT, 'docs/llm-wiki/index.md');

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.git') || ['node_modules','.gradle','build','dist'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, acc);
    else acc.push(path.relative(ROOT, p));
  }
  return acc;
}

const files = await walk(ROOT);
const readmes = files.filter((f) => /README\.md$/i.test(f));
const modules = files.filter((f) => /\.(ts|tsx|js|kt|java|md)$/.test(f)).slice(0, 120);
const content = `# LLM Wiki Index\n\n## Repository Scan\n${files.slice(0,200).map(f=>`- ${f}`).join('\n')}\n\n## README Scan\n${readmes.map(f=>`- ${f}`).join('\n')||'- none'}\n\n## Module Map\n${modules.map(f=>`- ${f}`).join('\n')}\n\n_Generated at: ${new Date().toISOString()}_\n`;
await writeFile(WIKI, content, 'utf8');
console.log('updated', WIKI);
