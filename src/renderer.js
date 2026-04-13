const state = {
  locale: localStorage.getItem('locale') || 'ko',
  theme: localStorage.getItem('theme') || 'dark',
  syncJobs: [],
  lastViewerPath: localStorage.getItem('lastViewerPath') || '',
  lastViewerRaw: localStorage.getItem('lastViewerRaw') || '',
  lastEncodeInput: localStorage.getItem('lastEncodeInput') || '',
  lastEncodeOutput: localStorage.getItem('lastEncodeOutput') || '',
  lastEncodingMode: localStorage.getItem('lastEncodingMode') || 'base64'
};

const i18n = {
  ko: {
    language: '언어',
    themeDark: '다크',
    themeLight: '라이트',
    tabViewer: 'Viewer',
    tabEncode: 'Encode/Decode',
    tabSync: 'Sync',
    viewerTitle: '파일 Viewer (diff / json / md)',
    openFile: '파일 열기',
    raw: '원본',
    rendered: '표시 결과',
    encodeTitle: '인코드/디코드',
    mode: '모드',
    encode: '인코드',
    decode: '디코드',
    input: '입력',
    output: '결과',
    syncTitle: '동기화 (source → target 미러)',
    addSync: '동기화 작업 추가',
    runSync: '동기화 실행',
    source: '소스',
    target: '타겟',
    pick: '선택',
    delete: '삭제',
    chooseSourceFirst: '먼저 소스 폴더를 선택하세요.',
    chooseTargetFirst: '먼저 타겟 폴더를 선택하세요.',
    noJobs: '등록된 동기화 작업이 없습니다.',
    decodeError: '디코드 중 오류가 발생했습니다.'
  },
  en: {
    language: 'Language',
    themeDark: 'Dark',
    themeLight: 'Light',
    tabViewer: 'Viewer',
    tabEncode: 'Encode/Decode',
    tabSync: 'Sync',
    viewerTitle: 'File Viewer (diff / json / md)',
    openFile: 'Open File',
    raw: 'Raw',
    rendered: 'Rendered',
    encodeTitle: 'Encode/Decode',
    mode: 'Mode',
    encode: 'Encode',
    decode: 'Decode',
    input: 'Input',
    output: 'Output',
    syncTitle: 'Sync (source → target mirror)',
    addSync: 'Add Sync Job',
    runSync: 'Run Sync',
    source: 'Source',
    target: 'Target',
    pick: 'Pick',
    delete: 'Delete',
    chooseSourceFirst: 'Pick the source folder first.',
    chooseTargetFirst: 'Pick the target folder first.',
    noJobs: 'No sync jobs.',
    decodeError: 'Decode failed.'
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

function applyI18n() {
  document.getElementById('languageLabel').textContent = t('language');
  document.getElementById('tabViewer').textContent = t('tabViewer');
  document.getElementById('tabEncode').textContent = t('tabEncode');
  document.getElementById('tabSync').textContent = t('tabSync');
  document.getElementById('viewerTitle').textContent = t('viewerTitle');
  document.getElementById('openFileBtn').textContent = t('openFile');
  document.getElementById('viewerRawTitle').textContent = t('raw');
  document.getElementById('viewerRenderedTitle').textContent = t('rendered');
  document.getElementById('encodeTitle').textContent = t('encodeTitle');
  document.getElementById('encodingLabel').textContent = t('mode');
  document.getElementById('encodeBtn').textContent = t('encode');
  document.getElementById('decodeBtn').textContent = t('decode');
  document.getElementById('inputTitle').textContent = t('input');
  document.getElementById('outputTitle').textContent = t('output');
  document.getElementById('syncTitle').textContent = t('syncTitle');
  document.getElementById('addSyncBtn').textContent = t('addSync');
  document.getElementById('runSyncBtn').textContent = t('runSync');
  setTheme(state.theme);
  renderSyncJobs();
}

function persistInputs() {
  localStorage.setItem('locale', state.locale);
  localStorage.setItem('lastViewerPath', document.getElementById('openedFilePath').textContent);
  localStorage.setItem('lastViewerRaw', document.getElementById('rawContent').value);
  localStorage.setItem('lastEncodeInput', document.getElementById('encodeInput').value);
  localStorage.setItem('lastEncodeOutput', document.getElementById('encodeOutput').value);
  localStorage.setItem('lastEncodingMode', document.getElementById('encodingMode').value);
}

function renderFile(ext, content) {
  if (ext === '.json') {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }

  if (ext === '.md') {
    return content
      .replace(/^### (.*)$/gm, '### $1')
      .replace(/^## (.*)$/gm, '## $1')
      .replace(/^# (.*)$/gm, '# $1');
  }

  return content;
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = {
    viewer: document.getElementById('viewerPanel'),
    encode: document.getElementById('encodePanel'),
    sync: document.getElementById('syncPanel')
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((other) => other.classList.remove('active'));
      tab.classList.add('active');
      Object.values(panels).forEach((panel) => panel.classList.remove('active'));
      panels[tab.dataset.tab].classList.add('active');
    });
  });
}

async function addSyncJob() {
  const source = await window.api.pickFolder();
  if (!source) {
    return;
  }

  const target = await window.api.pickFolder();
  if (!target) {
    return;
  }

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

async function bootstrap() {
  document.getElementById('languageSelect').value = state.locale;
  document.getElementById('encodingMode').value = state.lastEncodingMode;
  document.getElementById('openedFilePath').textContent = state.lastViewerPath;
  document.getElementById('rawContent').value = state.lastViewerRaw;
  document.getElementById('renderedContent').textContent = renderFile('', state.lastViewerRaw);
  document.getElementById('encodeInput').value = state.lastEncodeInput;
  document.getElementById('encodeOutput').value = state.lastEncodeOutput;

  state.syncJobs = await window.api.loadSyncJobs();

  setupTabs();
  applyI18n();

  document.getElementById('languageSelect').addEventListener('change', (event) => {
    state.locale = event.target.value;
    applyI18n();
    persistInputs();
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    persistInputs();
  });

  document.getElementById('openFileBtn').addEventListener('click', async () => {
    const fileData = await window.api.openFile();
    if (!fileData) {
      return;
    }

    document.getElementById('openedFilePath').textContent = fileData.path;
    document.getElementById('rawContent').value = fileData.content;
    document.getElementById('renderedContent').textContent = renderFile(fileData.path.slice(fileData.path.lastIndexOf('.')), fileData.content);
    persistInputs();
  });

  document.getElementById('encodeBtn').addEventListener('click', () => {
    const input = document.getElementById('encodeInput').value;
    const mode = document.getElementById('encodingMode').value;
    const output = mode === 'base64'
      ? btoa(unescape(encodeURIComponent(input)))
      : encodeURIComponent(input);
    document.getElementById('encodeOutput').value = output;
    persistInputs();
  });

  document.getElementById('decodeBtn').addEventListener('click', () => {
    try {
      const input = document.getElementById('encodeInput').value;
      const mode = document.getElementById('encodingMode').value;
      const output = mode === 'base64'
        ? decodeURIComponent(escape(atob(input)))
        : decodeURIComponent(input);
      document.getElementById('encodeOutput').value = output;
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
}

bootstrap();
