const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');

const APP_STATE_FILE = path.join(app.getPath('userData'), 'sync-jobs.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

async function ensureDir(targetPath) {
  await fsp.mkdir(targetPath, { recursive: true });
}

async function syncFolder(source, target) {
  const stats = await fsp.stat(source);
  if (!stats.isDirectory()) {
    throw new Error(`Source is not a directory: ${source}`);
  }

  await ensureDir(target);

  async function copyRecursive(srcDir, dstDir) {
    const entries = await fsp.readdir(srcDir, { withFileTypes: true });
    const sourceNames = new Set(entries.map((entry) => entry.name));

    await ensureDir(dstDir);

    const targetEntries = await fsp.readdir(dstDir, { withFileTypes: true });
    for (const targetEntry of targetEntries) {
      if (!sourceNames.has(targetEntry.name)) {
        const toRemove = path.join(dstDir, targetEntry.name);
        await fsp.rm(toRemove, { recursive: true, force: true });
      }
    }

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const dstPath = path.join(dstDir, entry.name);

      if (entry.isDirectory()) {
        await copyRecursive(srcPath, dstPath);
      } else if (entry.isFile()) {
        await ensureDir(path.dirname(dstPath));
        await fsp.copyFile(srcPath, dstPath);
      }
    }
  }

  await copyRecursive(source, target);
}

ipcMain.handle('dialog:open-file', async (_, options = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: options.filters || []
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selected = result.filePaths[0];
  const content = await fsp.readFile(selected, 'utf8');
  return {
    path: selected,
    content
  };
});

ipcMain.handle('dialog:pick-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('viewer:read-file', async (_, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const content = await fsp.readFile(filePath, 'utf8');
  return { ext, content, filePath };
});

ipcMain.handle('sync:run', async (_, jobs) => {
  const results = [];

  for (const job of jobs) {
    try {
      await syncFolder(job.source, job.target);
      results.push({
        id: job.id,
        status: 'success',
        message: `Synced: ${job.source} -> ${job.target}`
      });
    } catch (error) {
      results.push({
        id: job.id,
        status: 'error',
        message: error.message
      });
    }
  }

  return results;
});

ipcMain.handle('state:load-sync-jobs', async () => {
  if (!fs.existsSync(APP_STATE_FILE)) {
    return [];
  }

  const raw = await fsp.readFile(APP_STATE_FILE, 'utf8');
  return JSON.parse(raw);
});

ipcMain.handle('state:save-sync-jobs', async (_, jobs) => {
  await ensureDir(path.dirname(APP_STATE_FILE));
  await fsp.writeFile(APP_STATE_FILE, JSON.stringify(jobs, null, 2), 'utf8');
  return true;
});
