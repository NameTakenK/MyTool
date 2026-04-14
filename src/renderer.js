const state = {
  locale: localStorage.getItem('locale') || 'ko',
  theme: localStorage.getItem('theme') || 'dark',
  syncJobs: [],
  lastViewerPath: localStorage.getItem('lastViewerPath') || '',
  lastDiffInputA: localStorage.getItem('lastDiffInputA') || '',
  lastDiffInputB: localStorage.getItem('lastDiffInputB') || '',
  lastJsonInput: localStorage.getItem('lastJsonInput') || '',
  lastMarkdownInput: localStorage.getItem('lastMarkdownInput') || '',
  lastEncodeInput: localStorage.getItem('lastEncodeInput') || '',
  lastEncodeOutput: localStorage.getItem('lastEncodeOutput') || '',
  lastEncodingMode: localStorage.getItem('lastEncodingMode') || 'base64'
};

const i18n = {
  ko: {
    language: '언어',
    themeDark: '다크',
    themeLight: '라이트',
    sidebarTitle: '지원 기능',
    featureViewer: '파일/텍스트 Viewer',
    featureEncode: 'Encode/Decode',
    featureSync: '폴더 동기화',
    tabViewer: 'Viewer',
    tabEncode: 'Encode/Decode',
    tabSync: 'Sync',
    viewerTitle: '파일 Viewer (diff / json / md)',
    viewerDiffTitle: 'Diff 비교 (입력 2개)',
    viewerJsonTitle: 'JSON Pretty',
    viewerMarkdownTitle: 'Markdown Preview',
    openFile: '파일 열기',
    diffInputA: '원본(A)',
    diffInputB: '비교(B)',
    jsonInput: 'JSON 입력',
    markdownInput: 'Markdown 입력',
    diffEmpty: '비교할 텍스트를 입력하세요.',
    diffSame: '차이점이 없습니다.',
    jsonInvalid: '유효한 JSON이 아닙니다.',
    mdHint: 'Markdown 미리보기가 여기에 표시됩니다.',
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
    delete: '삭제',
    noJobs: '등록된 동기화 작업이 없습니다.',
    decodeError: '디코드 중 오류가 발생했습니다.'
  },
  en: {
    language: 'Language',
    themeDark: 'Dark',
    themeLight: 'Light',
    sidebarTitle: 'Supported Features',
    featureViewer: 'File/Text Viewer',
    featureEncode: 'Encode/Decode',
    featureSync: 'Folder Sync',
    tabViewer: 'Viewer',
    tabEncode: 'Encode/Decode',
    tabSync: 'Sync',
    viewerTitle: 'File Viewer (diff / json / md)',
    viewerDiffTitle: 'Diff Compare (2 inputs)',
    viewerJsonTitle: 'JSON Pretty',
    viewerMarkdownTitle: 'Markdown Preview',
    openFile: 'Open File',
    diffInputA: 'Original (A)',
    diffInputB: 'Compare (B)',
    jsonInput: 'JSON Input',
    markdownInput: 'Markdown Input',
    diffEmpty: 'Enter text to compare.',
    diffSame: 'No differences.',
    jsonInvalid: 'This is not valid JSON.',
    mdHint: 'Markdown preview appears here.',
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
    delete: 'Delete',
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

function escapeHtml(raw) {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderDiff() {
  const aLines = document.getElementById('diffInputA').value.split('\n');
  const bLines = document.getElementById('diffInputB').value.split('\n');
  const hasInput = aLines.join('').trim().length > 0 || bLines.join('').trim().length > 0;

  if (!hasInput) {
    document.getElementById('diffContent').textContent = t('diffEmpty');
    return;
  }

  const max = Math.max(aLines.length, bLines.length);
  const result = [];

  for (let i = 0; i < max; i += 1) {
    const left = aLines[i] ?? '';
    const right = bLines[i] ?? '';

    if (left === right) {
      result.push(`  ${left}`);
      continue;
    }

    if (left.length > 0) {
      result.push(`- ${left}`);
    }
    if (right.length > 0) {
      result.push(`+ ${right}`);
    }
  }

  document.getElementById('diffContent').textContent = result.length > 0 ? result.join('\n') : t('diffSame');
}

function renderJson() {
  const jsonInput = document.getElementById('jsonInput').value;
  if (!jsonInput.trim()) {
    document.getElementById('jsonContent').textContent = '';
    return;
  }

  try {
    document.getElementById('jsonContent').textContent = JSON.stringify(JSON.parse(jsonInput), null, 2);
  } catch {
    document.getElementById('jsonContent').textContent = t('jsonInvalid');
  }
}

function renderMarkdown() {
  const input = document.getElementById('markdownInput').value;
  if (!input.trim()) {
    document.getElementById('markdownPreview').innerHTML = `<p class="muted">${t('mdHint')}</p>`;
    return;
  }

  const safe = escapeHtml(input);
  const html = safe
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/(?:\r\n|\r|\n){2,}/g, '</p><p>')
    .replace(/\n/g, '<br />');

  const withLists = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  document.getElementById('markdownPreview').innerHTML = `<p>${withLists}</p>`;
}

function applyI18n() {
  document.getElementById('languageLabel').textContent = t('language');
  document.getElementById('sidebarTitle').textContent = t('sidebarTitle');
  document.getElementById('featureViewer').textContent = t('featureViewer');
  document.getElementById('featureEncode').textContent = t('featureEncode');
  document.getElementById('featureSync').textContent = t('featureSync');
  document.getElementById('tabViewer').textContent = t('tabViewer');
  document.getElementById('tabEncode').textContent = t('tabEncode');
  document.getElementById('tabSync').textContent = t('tabSync');
  document.getElementById('viewerTitle').textContent = t('viewerTitle');
  document.getElementById('viewerDiffTitle').textContent = t('viewerDiffTitle');
  document.getElementById('viewerJsonTitle').textContent = t('viewerJsonTitle');
  document.getElementById('viewerMarkdownTitle').textContent = t('viewerMarkdownTitle');
  document.getElementById('diffInputA').placeholder = t('diffInputA');
  document.getElementById('diffInputB').placeholder = t('diffInputB');
  document.getElementById('jsonInput').placeholder = t('jsonInput');
  document.getElementById('markdownInput').placeholder = t('markdownInput');
  document.getElementById('openFileBtn').textContent = t('openFile');
  document.getElementById('encodeTitle').textContent = t('encodeTitle');
  document.getElementById('encodingLabel').textContent = t('mode');
  document.getElementById('encodeBtn').textContent = t('encode');
  document.getElementById('decodeBtn').textContent = t('decode');
  document.getElementById('inputTitle').textContent = t('input');
  document.getElementById('outputTitle').textContent = t('output');
  document.getElementById('syncTitle').textContent = t('syncTitle');
  document.getElementById('addSyncBtn').textContent = t('addSync');
  document.getElementById('runSyncBtn').textContent = t('runSync');
  renderDiff();
  renderJson();
  renderMarkdown();
  setTheme(state.theme);
  renderSyncJobs();
}

function persistInputs() {
  localStorage.setItem('locale', state.locale);
  localStorage.setItem('lastViewerPath', document.getElementById('openedFilePath').textContent);
  localStorage.setItem('lastDiffInputA', document.getElementById('diffInputA').value);
  localStorage.setItem('lastDiffInputB', document.getElementById('diffInputB').value);
  localStorage.setItem('lastJsonInput', document.getElementById('jsonInput').value);
  localStorage.setItem('lastMarkdownInput', document.getElementById('markdownInput').value);
  localStorage.setItem('lastEncodeInput', document.getElementById('encodeInput').value);
  localStorage.setItem('lastEncodeOutput', document.getElementById('encodeOutput').value);
  localStorage.setItem('lastEncodingMode', document.getElementById('encodingMode').value);
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab, .feature-link'));
  const panels = {
    viewer: document.getElementById('viewerPanel'),
    encode: document.getElementById('encodePanel'),
    sync: document.getElementById('syncPanel')
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab.dataset.tab));
      document.querySelectorAll('.feature-link').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab.dataset.tab));
      Object.entries(panels).forEach(([key, panel]) => {
        panel.classList.toggle('active', key === tab.dataset.tab);
      });
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
  document.getElementById('diffInputA').value = state.lastDiffInputA;
  document.getElementById('diffInputB').value = state.lastDiffInputB;
  document.getElementById('jsonInput').value = state.lastJsonInput;
  document.getElementById('markdownInput').value = state.lastMarkdownInput;
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
    document.getElementById('diffInputA').value = fileData.content;
    document.getElementById('jsonInput').value = fileData.content;
    document.getElementById('markdownInput').value = fileData.content;
    renderDiff();
    renderJson();
    renderMarkdown();
    persistInputs();
  });

  document.getElementById('diffInputA').addEventListener('input', () => {
    renderDiff();
    persistInputs();
  });

  document.getElementById('diffInputB').addEventListener('input', () => {
    renderDiff();
    persistInputs();
  });

  document.getElementById('jsonInput').addEventListener('input', () => {
    renderJson();
    persistInputs();
  });

  document.getElementById('markdownInput').addEventListener('input', () => {
    renderMarkdown();
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
