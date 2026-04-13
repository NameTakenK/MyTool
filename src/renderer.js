const state = {
  locale: localStorage.getItem('locale') || 'ko',
  theme: localStorage.getItem('theme') || 'dark',
  syncJobs: [],
  lastViewerPath: localStorage.getItem('lastViewerPath') || '',
  diffInput: localStorage.getItem('diffInput') || '',
  jsonInput: localStorage.getItem('jsonInput') || '',
  mdInput: localStorage.getItem('mdInput') || '',
  lastEncodeInput: localStorage.getItem('lastEncodeInput') || '',
  lastEncodeOutput: localStorage.getItem('lastEncodeOutput') || '',
  lastEncodingMode: localStorage.getItem('lastEncodingMode') || 'base64'
};

const i18n = {
  ko: {
    sidebarCaption: '로컬 유틸리티 모음',
    navViewer: 'Viewer (diff/json/md)',
    navEncode: 'Encode/Decode',
    navSync: 'Folder Sync',
    language: '언어',
    themeDark: '다크',
    themeLight: '라이트',
    viewerTitle: 'Viewer - 직접 입력 / 파일 열기',
    openFile: '파일 열기',
    diff: 'DIFF',
    json: 'JSON',
    markdown: 'MARKDOWN',
    encodeTitle: '인코드/디코드',
    mode: '모드',
    encode: '인코드',
    decode: '디코드',
    syncTitle: '동기화 (source → target 미러)',
    addSync: '동기화 작업 추가',
    runSync: '동기화 실행',
    source: '소스',
    target: '타겟',
    delete: '삭제',
    noJobs: '등록된 동기화 작업이 없습니다.',
    decodeError: '디코드 중 오류가 발생했습니다.',
    invalidJson: '유효하지 않은 JSON 입니다.'
  },
  en: {
    sidebarCaption: 'Local utility suite',
    navViewer: 'Viewer (diff/json/md)',
    navEncode: 'Encode/Decode',
    navSync: 'Folder Sync',
    language: 'Language',
    themeDark: 'Dark',
    themeLight: 'Light',
    viewerTitle: 'Viewer - direct input / open file',
    openFile: 'Open File',
    diff: 'DIFF',
    json: 'JSON',
    markdown: 'MARKDOWN',
    encodeTitle: 'Encode/Decode',
    mode: 'Mode',
    encode: 'Encode',
    decode: 'Decode',
    syncTitle: 'Sync (source → target mirror)',
    addSync: 'Add Sync Job',
    runSync: 'Run Sync',
    source: 'Source',
    target: 'Target',
    delete: 'Delete',
    noJobs: 'No sync jobs.',
    decodeError: 'Decode failed.',
    invalidJson: 'Invalid JSON.'
  }
};

function t(key) {
  return i18n[state.locale][key] || key;
}

function setTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  state.theme = theme;
  localStorage.setItem('theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'light' ? t('themeDark') : t('themeLight');
}

function renderMarkdown(text) {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  return escaped
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function updateViewerOutputs() {
  const diffInput = document.getElementById('diffInput').value;
  const jsonInput = document.getElementById('jsonInput').value;
  const mdInput = document.getElementById('mdInput').value;

  document.getElementById('diffOutput').textContent = diffInput;

  try {
    const formatted = jsonInput ? JSON.stringify(JSON.parse(jsonInput), null, 2) : '';
    document.getElementById('jsonOutput').textContent = formatted;
  } catch {
    document.getElementById('jsonOutput').textContent = t('invalidJson');
  }

  document.getElementById('mdOutput').innerHTML = renderMarkdown(mdInput);
}

function applyI18n() {
  document.getElementById('sidebarCaption').textContent = t('sidebarCaption');
  document.getElementById('navViewer').textContent = t('navViewer');
  document.getElementById('navEncode').textContent = t('navEncode');
  document.getElementById('navSync').textContent = t('navSync');
  document.getElementById('languageLabel').textContent = t('language');
  document.getElementById('viewerTitle').textContent = t('viewerTitle');
  document.getElementById('openFileBtn').textContent = t('openFile');
  document.getElementById('viewerDiffTitle').textContent = t('diff');
  document.getElementById('viewerJsonTitle').textContent = t('json');
  document.getElementById('viewerMdTitle').textContent = t('markdown');
  document.getElementById('encodeTitle').textContent = t('encodeTitle');
  document.getElementById('encodingLabel').textContent = t('mode');
  document.getElementById('encodeBtn').textContent = t('encode');
  document.getElementById('decodeBtn').textContent = t('decode');
  document.getElementById('syncTitle').textContent = t('syncTitle');
  document.getElementById('addSyncBtn').textContent = t('addSync');
  document.getElementById('runSyncBtn').textContent = t('runSync');
  setTheme(state.theme);
  renderSyncJobs();
  updateViewerOutputs();
}

function persistInputs() {
  localStorage.setItem('locale', state.locale);
  localStorage.setItem('lastViewerPath', document.getElementById('openedFilePath').textContent);
  localStorage.setItem('diffInput', document.getElementById('diffInput').value);
  localStorage.setItem('jsonInput', document.getElementById('jsonInput').value);
  localStorage.setItem('mdInput', document.getElementById('mdInput').value);
  localStorage.setItem('lastEncodeInput', document.getElementById('encodeInput').value);
  localStorage.setItem('lastEncodeOutput', document.getElementById('encodeOutput').value);
  localStorage.setItem('lastEncodingMode', document.getElementById('encodingMode').value);
}

function setupNavigation() {
  const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      navButtons.forEach((other) => other.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
      document.getElementById(btn.dataset.panel).classList.add('active');
    });
  });
}

async function addSyncJob() {
  const source = await window.api.pickFolder();
  if (!source) return;

  const target = await window.api.pickFolder();
  if (!target) return;

  state.syncJobs.push({ id: Date.now().toString(), source, target });
  renderSyncJobs();
  await window.api.saveSyncJobs(state.syncJobs);
}

function renderSyncJobs() {
  const container = document.getElementById('syncJobs');
  container.innerHTML = '';

  if (state.syncJobs.length === 0) {
    container.textContent = t('noJobs');
    return;
  }

  for (const job of state.syncJobs) {
    const row = document.createElement('div');
    row.className = 'sync-job';

    const sourceLabel = document.createElement('strong');
    sourceLabel.textContent = t('source');
    row.appendChild(sourceLabel);

    const sourceText = document.createElement('span');
    sourceText.textContent = job.source;
    row.appendChild(sourceText);

    const targetLabel = document.createElement('strong');
    targetLabel.textContent = t('target');
    row.appendChild(targetLabel);

    const targetText = document.createElement('span');
    targetText.textContent = job.target;
    row.appendChild(targetText);

    const removeButton = document.createElement('button');
    removeButton.textContent = t('delete');
    removeButton.addEventListener('click', async () => {
      state.syncJobs = state.syncJobs.filter((item) => item.id !== job.id);
      renderSyncJobs();
      await window.api.saveSyncJobs(state.syncJobs);
    });
    row.appendChild(removeButton);

    container.appendChild(row);
  }
}

function applyFileToViewer(path, content) {
  const ext = path.split('.').pop()?.toLowerCase();

  if (ext === 'json') {
    document.getElementById('jsonInput').value = content;
  } else if (ext === 'md') {
    document.getElementById('mdInput').value = content;
  } else {
    document.getElementById('diffInput').value = content;
  }

  updateViewerOutputs();
  persistInputs();
}

async function bootstrap() {
  document.getElementById('languageSelect').value = state.locale;
  document.getElementById('encodingMode').value = state.lastEncodingMode;
  document.getElementById('openedFilePath').textContent = state.lastViewerPath;
  document.getElementById('diffInput').value = state.diffInput;
  document.getElementById('jsonInput').value = state.jsonInput;
  document.getElementById('mdInput').value = state.mdInput;
  document.getElementById('encodeInput').value = state.lastEncodeInput;
  document.getElementById('encodeOutput').value = state.lastEncodeOutput;

  state.syncJobs = await window.api.loadSyncJobs();

  setupNavigation();
  applyI18n();

  document.getElementById('languageSelect').addEventListener('change', (event) => {
    state.locale = event.target.value;
    applyI18n();
    persistInputs();
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    persistInputs();
  });

  document.getElementById('openFileBtn').addEventListener('click', async () => {
    const fileData = await window.api.openFile();
    if (!fileData) return;

    document.getElementById('openedFilePath').textContent = fileData.path;
    applyFileToViewer(fileData.path, fileData.content);
  });

  ['diffInput', 'jsonInput', 'mdInput'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      updateViewerOutputs();
      persistInputs();
    });
  });

  document.getElementById('encodeBtn').addEventListener('click', () => {
    const input = document.getElementById('encodeInput').value;
    const mode = document.getElementById('encodingMode').value;
    document.getElementById('encodeOutput').value = mode === 'base64'
      ? btoa(unescape(encodeURIComponent(input)))
      : encodeURIComponent(input);
    persistInputs();
  });

  document.getElementById('decodeBtn').addEventListener('click', () => {
    try {
      const input = document.getElementById('encodeInput').value;
      const mode = document.getElementById('encodingMode').value;
      document.getElementById('encodeOutput').value = mode === 'base64'
        ? decodeURIComponent(escape(atob(input)))
        : decodeURIComponent(input);
      persistInputs();
    } catch {
      document.getElementById('encodeOutput').value = t('decodeError');
    }
  });

  document.getElementById('addSyncBtn').addEventListener('click', addSyncJob);
  document.getElementById('runSyncBtn').addEventListener('click', async () => {
    const result = await window.api.runSync(state.syncJobs);
    document.getElementById('syncResult').textContent = JSON.stringify(result, null, 2);
  });

  document.getElementById('encodeInput').addEventListener('input', persistInputs);
  document.getElementById('encodingMode').addEventListener('change', persistInputs);

  updateViewerOutputs();
}

bootstrap();
