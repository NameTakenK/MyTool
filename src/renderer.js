const state = {
  vaultPath: localStorage.getItem('vaultPath') || '',
  repoUrl: localStorage.getItem('repoUrl') || '',
  tree: [],
  currentNote: '',
  markdown: ''
};

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function renderMarkdown(md) {
  let html = escapeHtml(md);
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">[[$1]]</span>');
  return html.replace(/\n/g, '<br/>');
}

function flattenFiles(nodes, output = []) { for (const n of nodes) { if (n.type === 'file') output.push(n.path); if (n.children) flattenFiles(n.children, output); } return output; }

function renderTree(nodes, container, query = '') {
  container.innerHTML = '';
  const addNode = (node, parent, depth) => {
    if (node.type === 'folder') {
      const folder = document.createElement('div'); folder.className = 'tree-folder'; folder.textContent = `${'  '.repeat(depth)}📁 ${node.name}`; parent.appendChild(folder);
      node.children.forEach((child) => addNode(child, parent, depth + 1)); return;
    }
    if (query && !node.path.toLowerCase().includes(query.toLowerCase())) return;
    const item = document.createElement('button');
    item.className = `tree-file ${state.currentNote === node.path ? 'active' : ''}`;
    item.textContent = `${'  '.repeat(depth)}📝 ${node.name}`;
    item.addEventListener('click', () => openNote(node.path));
    parent.appendChild(item);
  };
  nodes.forEach((node) => addNode(node, container, 0));
}

async function loadTree() {
  if (!state.vaultPath) return;
  state.tree = await window.api.loadVaultTree(state.vaultPath);
  renderTree(state.tree, document.getElementById('tree'), document.getElementById('searchInput').value);
}

async function openNote(notePath) {
  state.currentNote = notePath;
  state.markdown = await window.api.readNote(state.vaultPath, notePath);
  document.getElementById('currentNote').textContent = notePath;
  document.getElementById('editor').value = state.markdown;
  document.getElementById('preview').innerHTML = renderMarkdown(state.markdown);
  renderTree(state.tree, document.getElementById('tree'), document.getElementById('searchInput').value);
}

async function saveCurrentNote() {
  if (!state.currentNote) return;
  await window.api.saveNote(state.vaultPath, state.currentNote, document.getElementById('editor').value);
  document.getElementById('syncStatus').textContent = 'Saved and pushed to GitHub (if remote configured).';
}

async function createNote() {
  if (!state.vaultPath) return;
  const fileName = window.prompt('새 문서 이름을 입력하세요:', 'Untitled');
  if (!fileName) return;
  const created = await window.api.createNote(state.vaultPath, '', fileName);
  await loadTree();
  await openNote(created);
  document.getElementById('syncStatus').textContent = `${created} 생성됨 (.md)`;
}

async function pickVault() {
  const selected = await window.api.pickVault();
  if (!selected) return;
  state.vaultPath = selected;
  localStorage.setItem('vaultPath', selected);
  document.getElementById('vaultPath').textContent = selected;
  await loadTree();
  const files = flattenFiles(state.tree);
  if (files.length > 0) await openNote(files[0]);
}

async function connectGithub() {
  const repoUrl = document.getElementById('repoUrl').value.trim();
  if (!repoUrl) return;

  try {
    document.getElementById('syncStatus').textContent = 'GitHub 저장소 연결 중...';
    const vaultPath = await window.api.connectGithub(repoUrl);
    state.repoUrl = repoUrl;
    state.vaultPath = vaultPath;
    localStorage.setItem('repoUrl', repoUrl);
    localStorage.setItem('vaultPath', vaultPath);
    document.getElementById('vaultPath').textContent = vaultPath;
    document.getElementById('syncStatus').textContent = 'GitHub 연결 완료. 문서 추가 시 .md 파일로 커밋/푸시됩니다.';
    await loadTree();
  } catch (error) {
    document.getElementById('syncStatus').textContent = `연결 실패: ${error.message}`;
  }
}

function setup() {
  document.getElementById('repoUrl').value = state.repoUrl;
  document.getElementById('openVaultBtn').addEventListener('click', pickVault);
  document.getElementById('connectGithubBtn').addEventListener('click', connectGithub);
  document.getElementById('newNoteBtn').addEventListener('click', createNote);
  document.getElementById('saveBtn').addEventListener('click', saveCurrentNote);
  document.getElementById('editor').addEventListener('input', (event) => {
    state.markdown = event.target.value;
    document.getElementById('preview').innerHTML = renderMarkdown(state.markdown);
  });
  document.getElementById('searchInput').addEventListener('input', (event) => {
    renderTree(state.tree, document.getElementById('tree'), event.target.value);
  });

  if (state.vaultPath) {
    document.getElementById('vaultPath').textContent = state.vaultPath;
    loadTree();
  }
}

setup();
