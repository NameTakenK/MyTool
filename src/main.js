const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');

const execFileAsync = promisify(execFile);

function enablePortableModeIfRequested() {
  const portableFlag = process.argv.includes('--portable') || process.env.PORTABLE === '1';
  if (!portableFlag) return;
  const portableRoot = path.join(path.dirname(app.getPath('exe')), 'portable-data');
  app.setPath('userData', portableRoot);
}

enablePortableModeIfRequested();

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function repoKey(repoUrl) {
  return createHash('sha1').update(repoUrl).digest('hex').slice(0, 12);
}

function repoRoot() {
  return path.join(app.getPath('userData'), 'repos');
}

async function runGit(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

async function ensureGithubRepo(repoUrl) {
  const dir = path.join(repoRoot(), repoKey(repoUrl));
  await fs.mkdir(repoRoot(), { recursive: true });

  try {
    await fs.access(path.join(dir, '.git'));
    await runGit(['pull', '--rebase'], dir).catch(() => runGit(['pull'], dir));
  } catch {
    await runGit(['clone', repoUrl, dir], process.cwd());
  }

  return dir;
}

async function buildTree(rootPath, currentPath = rootPath) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const nodes = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(currentPath, entry.name);
    const relPath = path.relative(rootPath, fullPath).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      nodes.push({ type: 'folder', name: entry.name, path: relPath, children: await buildTree(rootPath, fullPath) });
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      nodes.push({ type: 'file', name: entry.name, path: relPath });
    }
  }
  return nodes;
}

async function autoCommitAndPush(vaultPath, notePath, action) {
  await runGit(['add', notePath], vaultPath);
  const { stdout } = await runGit(['status', '--porcelain'], vaultPath);
  if (!stdout.trim()) return;

  await runGit(['config', 'user.name', 'MyTool Bot'], vaultPath).catch(() => {});
  await runGit(['config', 'user.email', 'mytool-bot@localhost'], vaultPath).catch(() => {});

  await runGit(['commit', '-m', `${action}: ${notePath}`], vaultPath);
  await runGit(['push'], vaultPath);
}

ipcMain.handle('vault:pick', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('github:connect', async (_, repoUrl) => {
  if (!repoUrl || !repoUrl.includes('github.com')) {
    throw new Error('유효한 GitHub 저장소 주소를 입력하세요.');
  }
  const vaultPath = await ensureGithubRepo(repoUrl.trim());
  return vaultPath;
});

ipcMain.handle('vault:tree', async (_, vaultPath) => buildTree(vaultPath));
ipcMain.handle('note:read', async (_, vaultPath, notePath) => fs.readFile(path.join(vaultPath, notePath), 'utf8'));

ipcMain.handle('note:save', async (_, vaultPath, notePath, content) => {
  const target = path.join(vaultPath, notePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
  await autoCommitAndPush(vaultPath, notePath, 'update').catch(() => {});
  return true;
});

ipcMain.handle('note:create', async (_, vaultPath, parentRelativePath, fileName) => {
  const safeName = (fileName.endsWith('.md') ? fileName : `${fileName}.md`).replace(/[<>:"|?*]/g, '-');
  const target = path.join(vaultPath, parentRelativePath || '', safeName);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, '# New Note\n', { flag: 'wx' });
  const rel = path.relative(vaultPath, target).replaceAll('\\', '/');
  await autoCommitAndPush(vaultPath, rel, 'create').catch(() => {});
  return rel;
});
