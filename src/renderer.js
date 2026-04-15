const state = {
  locale: localStorage.getItem('locale') || 'ko',
  theme: localStorage.getItem('theme') || 'dark',
  syncJobs: [],
  lastViewerPath: localStorage.getItem('lastViewerPath') || '',
  lastViewerRawLeft: localStorage.getItem('lastViewerRawLeft') || '',
  lastViewerRawRight: localStorage.getItem('lastViewerRawRight') || '',
  lastEncodeInput: localStorage.getItem('lastEncodeInput') || '',
  lastEncodeOutput: localStorage.getItem('lastEncodeOutput') || '',
  lastEncodingMode: localStorage.getItem('lastEncodingMode') || 'base64',
  viewerOutputTab: localStorage.getItem('viewerOutputTab') || 'diff'
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
    viewerLeftInputTitle: '입력 1 (원본)',
    viewerRightInputTitle: '입력 2 (비교)',
    viewerDiffTitle: 'Diff 결과',
    viewerJsonTitle: 'JSON Pretty',
    viewerMarkdownTitle: 'Markdown Preview',
    openFile: '파일 열기 (입력 1)',
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
    decodeError: '디코드 중 오류가 발생했습니다.',
    invalidJson: '유효한 JSON이 아닙니다.',
    markdownHint: 'Markdown 렌더링 결과입니다.',
    emptyDiff: '비교할 내용이 없습니다.',
    diffSame: '변경점이 없습니다.'
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
    viewerLeftInputTitle: 'Input 1 (base)',
    viewerRightInputTitle: 'Input 2 (compare)',
    viewerDiffTitle: 'Diff Result',
    viewerJsonTitle: 'JSON Pretty',
    viewerMarkdownTitle: 'Markdown Preview',
    openFile: 'Open File (Input 1)',
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
    decodeError: 'Decode failed.',
    invalidJson: 'This is not valid JSON.',
    markdownHint: 'Rendered markdown preview.',
    emptyDiff: 'No content to compare.',
    diffSame: 'No changes detected.'
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

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(markdown) {
  if (!markdown.trim()) {
    return `<p class="muted">${t('markdownHint')}</p>`;
  }

  const blocks = markdown.split('\n');
  let inList = false;
  let html = '';

  for (const line of blocks) {
    if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${renderInlineMarkdown(line.slice(2))}</li>`;
      continue;
    }

    if (inList) {
      html += '</ul>';
      inList = false;
    }

    const headingMatch = line.match(/^(#{1,3})\s*(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      html += `<h${level}>${renderInlineMarkdown(headingText)}</h${level}>`;
    } else if (line.trim() === '') {
      html += '<br />';
    } else {
      html += `<p>${renderInlineMarkdown(line)}</p>`;
    }
  }

  if (inList) {
    html += '</ul>';
  }

  return html;
}

function createDiffView(leftContent, rightContent) {
  const leftLines = leftContent.split('\n');
  const rightLines = rightContent.split('\n');

  if (!leftContent.trim() && !rightContent.trim()) {
    return t('emptyDiff');
  }

  const rows = leftLines.length;
  const cols = rightLines.length;
  const lcs = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      if (leftLines[i] === rightLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const output = [];
  let i = 0;
  let j = 0;

  while (i < rows && j < cols) {
    if (leftLines[i] === rightLines[j]) {
      output.push(`  ${leftLines[i]}`);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      output.push(`- ${leftLines[i]}`);
      i += 1;
    } else {
      output.push(`+ ${rightLines[j]}`);
      j += 1;
    }
  }

  while (i < rows) {
    output.push(`- ${leftLines[i]}`);
    i += 1;
  }

  while (j < cols) {
    output.push(`+ ${rightLines[j]}`);
    j += 1;
  }

  const onlyEqual = output.every((line) => line.startsWith('  '));
  return onlyEqual ? `${t('diffSame')}\n\n${leftContent}` : output.join('\n');
}

function renderViewerOutputs(leftContent, rightContent) {
  document.getElementById('diffContent').textContent = createDiffView(leftContent, rightContent);

  try {
    const json = JSON.parse(rightContent || leftContent);
    document.getElementById('jsonContent').textContent = JSON.stringify(json, null, 2);
  } catch {
    document.getElementById('jsonContent').textContent = t('invalidJson');
  }

  document.getElementById('markdownContent').innerHTML = renderMarkdown(rightContent || leftContent);
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
  document.getElementById('viewerLeftInputTitle').textContent = t('viewerLeftInputTitle');
  document.getElementById('viewerRightInputTitle').textContent = t('viewerRightInputTitle');
  document.getElementById('viewerDiffTitle').textContent = t('viewerDiffTitle');
  document.getElementById('viewerJsonTitle').textContent = t('viewerJsonTitle');
  document.getElementById('viewerMarkdownTitle').textContent = t('viewerMarkdownTitle');
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
  renderViewerOutputs(document.getElementById('rawContentLeft').value, document.getElementById('rawContentRight').value);
  setTheme(state.theme);
  renderSyncJobs();
}

function persistInputs() {
  localStorage.setItem('locale', state.locale);
  localStorage.setItem('lastViewerPath', document.getElementById('openedFilePath').textContent);
  localStorage.setItem('lastViewerRawLeft', document.getElementById('rawContentLeft').value);
  localStorage.setItem('lastViewerRawRight', document.getElementById('rawContentRight').value);
  localStorage.setItem('lastEncodeInput', document.getElementById('encodeInput').value);
  localStorage.setItem('lastEncodeOutput', document.getElementById('encodeOutput').value);
  localStorage.setItem('lastEncodingMode', document.getElementById('encodingMode').value);
  localStorage.setItem('viewerOutputTab', state.viewerOutputTab);
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

function setupOutputTabs() {
  const tabs = Array.from(document.querySelectorAll('.output-tab'));
  const panels = Array.from(document.querySelectorAll('.output-panel'));

  const activate = (outputType) => {
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.output === outputType));
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.outputPanel === outputType));
    state.viewerOutputTab = outputType;
    localStorage.setItem('viewerOutputTab', outputType);
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab.dataset.output));
  });

  const initial = tabs.some((tab) => tab.dataset.output === state.viewerOutputTab)
    ? state.viewerOutputTab
    : 'diff';
  activate(initial);
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
  document.getElementById('rawContentLeft').value = state.lastViewerRawLeft;
  document.getElementById('rawContentRight').value = state.lastViewerRawRight;
  renderViewerOutputs(state.lastViewerRawLeft, state.lastViewerRawRight);
  document.getElementById('encodeInput').value = state.lastEncodeInput;
  document.getElementById('encodeOutput').value = state.lastEncodeOutput;

  state.syncJobs = await window.api.loadSyncJobs();

  setupTabs();
  setupOutputTabs();
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
    document.getElementById('rawContentLeft').value = fileData.content;
    renderViewerOutputs(fileData.content, document.getElementById('rawContentRight').value);
    persistInputs();
  });

  document.getElementById('rawContentLeft').addEventListener('input', () => {
    renderViewerOutputs(document.getElementById('rawContentLeft').value, document.getElementById('rawContentRight').value);
    persistInputs();
  });

  document.getElementById('rawContentRight').addEventListener('input', () => {
    renderViewerOutputs(document.getElementById('rawContentLeft').value, document.getElementById('rawContentRight').value);
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
