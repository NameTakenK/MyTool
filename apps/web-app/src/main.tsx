import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import './styles.css';

type Doc = { path: string; content: string; zone: 'source' | 'wiki'; sha?: string };
type Screen = 'files' | 'graph' | 'askSearch' | 'settings';
type GitHubConfig = {
  host: string;
  owner: string; repo: string; branch: string; token: string;
  sourcePath: string; wikiPath: string; backupPath: string;
};
type LlmProvider = 'openai' | 'gemini' | 'gauss';
type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
};
type ConflictItem = { path: string; reason: string };
type BackupSnapshot = { at: string; docs: Doc[] };
type GraphNode = { id: string; x: number; y: number };

const CFG_KEY = 'llm-wiki-github-config';
const LLM_CFG_KEY = 'llm-wiki-llm-config';
const PROMPT_REF_KEY = 'llm-wiki-prompt-ref';
const DOCS_CACHE_KEY = 'llm-wiki-local-docs';
const LOCAL_ONLY_KEY = 'llm-wiki-local-only';
const normalizeHost = (host: string) => host.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
const getApiBase = (host: string) => normalizeHost(host) === 'github.com' || !normalizeHost(host) ? 'https://api.github.com' : `https://${normalizeHost(host)}/api/v3`;
const b64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};
const unb64 = (text: string) => {
  const binary = atob(text);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const parseLinks = (text: string) => [
  ...[...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]),
  ...[...text.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)].map((m) => m[1])
];

const normalizeOwner = (owner: string) => owner.trim().replace(/^\/+/, '');
const normalizeRepo = (repo: string) => repo.trim().replace(/^\/+/, '').replace(/\.git$/, '');
const normalizeContentPath = (path: string) => path.split('/').filter(Boolean).map((seg) => encodeURIComponent(seg)).join('/');

async function ghApi(config: GitHubConfig, path: string, init?: RequestInit) {
  const apiBase = getApiBase(config.host);
  const safeOwner = normalizeOwner(config.owner);
  const safeRepo = normalizeRepo(config.repo);
  const safePath = normalizeContentPath(path);
  const url = `${apiBase}/repos/${safeOwner}/${safeRepo}/contents/${safePath}${init?.method === 'PUT' || init?.method === 'DELETE' ? '' : `?ref=${config.branch}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub API ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`);
  }
  return res.json();
}

async function loadMarkdownTree(config: GitHubConfig, rootPath: string, zone: 'source' | 'wiki'): Promise<Doc[]> {
  let list: any;
  try {
    list = await ghApi(config, rootPath);
  } catch (e: any) {
    if (String(e?.message || '').includes('GitHub API 404')) return [];
    throw e;
  }
  const arr = Array.isArray(list) ? list : [list];
  const docs: Doc[] = [];
  for (const item of arr) {
    if (item.type === 'dir') docs.push(...await loadMarkdownTree(config, item.path, zone));
    else if (item.type === 'file' && item.name.endsWith('.md')) {
      const file = await ghApi(config, item.path);
      docs.push({ path: item.path, content: unb64((file.content || '').replace(/\n/g, '')), zone, sha: file.sha });
    }
  }
  return docs;
}

function App() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [active, setActive] = useState('');
  const [question, setQuestion] = useState('');
  const [askMatches, setAskMatches] = useState<Doc[]>([]);
  const [screen, setScreen] = useState<Screen>('files');
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [status, setStatus] = useState('연결 필요');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [refreshEnabled, setRefreshEnabled] = useState(true);
  const [lastRemoteSignature, setLastRemoteSignature] = useState('');
  const [connected, setConnected] = useState(false);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [localOnlyPaths, setLocalOnlyPaths] = useState<string[]>([]);
  const [cfg, setCfg] = useState<GitHubConfig>({
    host: 'github.com', owner: '', repo: '', branch: 'main', token: '',
    sourcePath: 'docs/source', wikiPath: 'docs/llm-wiki', backupPath: 'docs/backups'
  });
  const [llmCfg, setLlmCfg] = useState<LlmConfig>({ provider: 'openai', apiKey: '', model: 'gpt-4.1-mini' });
  const [promptRef, setPromptRef] = useState('https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f');
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>([]);
  const [highlightTerm, setHighlightTerm] = useState('');
  const [fileOrder, setFileOrder] = useState<Record<string, number>>({});
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [graphSelected, setGraphSelected] = useState('');
  const [leftPaneW, setLeftPaneW] = useState(320);
  const [rightPaneW, setRightPaneW] = useState(280);
  const [dragging, setDragging] = useState<null | 'left' | 'right'>(null);
  const didAutoSync = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const activeDoc = docs.find((d) => d.path === active) ?? docs[0];
  const backlinks = useMemo(() => docs.filter((d) => d.path !== active && parseLinks(d.content).some((l) => active.includes(l.replace('./', '')))), [docs, active]);

  const syncFromServer = async (trigger: 'startup' | 'manual') => {
    if (trigger === 'manual' && !window.confirm('Refresh from server now?')) return;
    if (!cfg.host || !cfg.owner || !cfg.repo || !cfg.token) {
      setConnected(false);
      setStatus('config required: host/owner/repo/token');
      return;
    }
    setIsRefreshing(true);
    setStatus(`syncing (${trigger})`);
    setBackups((prev) => [{ at: new Date().toISOString(), docs: structuredClone(docs) }, ...prev].slice(0, 20));
    try {
      const sourceDocs = await loadMarkdownTree(cfg, cfg.sourcePath, 'source');
      const wikiDocs = await loadMarkdownTree(cfg, cfg.wikiPath, 'wiki');
      const remoteMerged = [...sourceDocs, ...wikiDocs];
      const remoteSig = remoteMerged.map((d) => `${d.path}:${d.sha || ''}`).sort().join('|');
      const localOnlyDocs = docs.filter((d) => localOnlyPaths.includes(d.path));
      const merged = [...remoteMerged, ...localOnlyDocs.filter((local) => !remoteMerged.some((r) => r.path === local.path))];
      setDocs(merged);
      setActive(merged[0]?.path ?? '');
      setConnected(true);
      if (remoteSig === lastRemoteSignature) {
        setStatus(`synced (${trigger}) - no server changes`);
        setRefreshEnabled(false);
      } else {
        setStatus(`synced (${trigger})`);
        setRefreshEnabled(false);
        setLastRemoteSignature(remoteSig);
      }
    } catch (e: any) {
      setConnected(false);
      setStatus(`sync failed: ${e.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const pushLocalToServer = async () => {
    if (!window.confirm('Push local changes to server now?')) return;
    if (!connected) return setStatus('connect first');
    const localDocs = docs.filter((d) => localOnlyPaths.includes(d.path));
    if (!localDocs.length) return setStatus('no local changes to push');
    try {
      setIsPushing(true);
      for (const doc of localDocs) {
        try {
          const res = await ghApi(cfg, doc.path, {
            method: 'PUT',
            body: JSON.stringify({ message: `web: push ${doc.path}`, content: b64(doc.content), branch: cfg.branch, sha: doc.sha })
          });
          setDocs((prev) => prev.map((d) => d.path === doc.path ? { ...d, sha: res.content?.sha || d.sha } : d));
        } catch (e: any) {
          const msg = String(e?.message || '');
          if (!msg.includes('GitHub API 409')) throw e;
          const latest = await ghApi(cfg, doc.path);
          try {
            const retry = await ghApi(cfg, doc.path, {
              method: 'PUT',
              body: JSON.stringify({ message: `web: push(retry) ${doc.path}`, content: b64(doc.content), branch: cfg.branch, sha: latest.sha })
            });
            setDocs((prev) => prev.map((d) => d.path === doc.path ? { ...d, sha: retry.content?.sha || latest.sha } : d));
          } catch (retryErr: any) {
            setConflicts((prev) => [...prev.filter((c) => c.path !== doc.path), { path: doc.path, reason: String(retryErr?.message || retryErr) }]);
          }
        }
      }
      setLocalOnlyPaths([]);
      setStatus(`pushed local changes: ${localDocs.length}`);
      setRefreshEnabled(true);
      await syncFromServer('manual');
      if (conflicts.length) setStatus(`pushed with conflicts: ${conflicts.length}`);
    } catch (e: any) {
      setStatus(`push failed: ${e.message}`);
    } finally {
      setIsPushing(false);
    }
  };

  const saveSettingsAndConnect = async () => {
    setStatus('settings saved');
    await syncFromServer('manual');
  };

  const callLlm = async (prompt: string) => {
    if (!llmCfg.apiKey) throw new Error('LLM API key required');
    if (llmCfg.provider === 'gauss') {
      const res = await fetch('https://agent.sec.samsung.net/api/v1/run/c3b7d293-8d05-4f9f-ab46-b15737f4c476?stream=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': llmCfg.apiKey },
        body: JSON.stringify({ input_type: 'chat', output_type: 'chat', input_value: prompt })
      });
      if (!res.ok) throw new Error(`Gauss API ${res.status}`);
      return JSON.stringify(await res.json());
    }
    if (llmCfg.provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llmCfg.apiKey}` },
        body: JSON.stringify({ model: llmCfg.model || 'gpt-4.1-mini', input: prompt })
      });
      if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
      const data = await res.json();
      return data.output_text || JSON.stringify(data);
    }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${llmCfg.model || 'gemini-1.5-flash'}:generateContent?key=${llmCfg.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!res.ok) throw new Error(`Gemini API ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
  };

  const buildWikiPrompt = () => `이걸 참고해서 llm wiki 만들어줘\n- ${promptRef}\n\n- 입력 소스(읽기 전용): ${cfg.sourcePath}\n- 출력 위키(수정 대상): ${cfg.wikiPath}\n- 메인 인덱스: ${cfg.wikiPath}/index.md\n- 작업 로그: ${cfg.wikiPath}/log.md`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildWikiPrompt());
      setStatus('wiki prompt copied');
    } catch {
      setStatus('failed to copy prompt');
    }
  };

  const createFile = (baseDir: string) => {
    const input = window.prompt('새 파일명', 'new-note');
    if (!input) return;
    const safeBase = input.replace(/^\/+/, '').replace(/\.\./g, '').trim();
    const safe = safeBase.endsWith('.md') ? safeBase : `${safeBase}.md`;
    if (!safe) return setStatus('invalid file name');
    const path = `${baseDir}/${safe}`.replace(/^\/+/, '');
    if (docs.some((d) => d.path === path)) return setStatus('file already exists');
    const zone: 'source' | 'wiki' = path.startsWith(cfg.sourcePath) ? 'source' : 'wiki';
    const newDoc: Doc = { path, content: `# ${safe.replace('.md', '')}\n`, zone, sha: undefined };
    setDocs((prev) => [newDoc, ...prev]);
    setLocalOnlyPaths((prev) => Array.from(new Set([...prev, path])));
    setActive(path);
    setStatus(`created local file: ${path}`);
    setDraftText(newDoc.content);
  };

  const renameFile = (oldPath: string) => {
    const oldName = oldPath.split('/').pop() || '';
    const nextName = window.prompt('새 파일명', oldName?.replace(/\.md$/, '') || '');
    if (!nextName || nextName === oldName) return;
    const normalizedNext = nextName.endsWith('.md') ? nextName : `${nextName}.md`;
    const dir = oldPath.split('/').slice(0, -1).join('/');
    const newPath = `${dir}/${normalizedNext}`;
    if (docs.some((d) => d.path === newPath)) return setStatus('target already exists');
    setDocs((prev) => prev.map((d) => d.path === oldPath ? { ...d, path: newPath, sha: undefined } : d));
    setLocalOnlyPaths((prev) => Array.from(new Set([...prev.filter((p) => p !== oldPath), newPath])));
    if (active === oldPath) setActive(newPath);
    setStatus(`renamed local: ${oldPath} -> ${newPath}`);
  };

  const saveLocalEdit = () => {
    if (!activeDoc) return;
    setDocs((prev) => prev.map((d) => d.path === active ? { ...d, content: draftText } : d));
    setLocalOnlyPaths((prev) => Array.from(new Set([...prev, active])));
    setDirty(false);
    setStatus(`saved local: ${active}`);
  };

  

  

  const deleteLocalFile = (path: string) => {
    const ok = window.confirm(`Delete local file from editor list?\n${path}`);
    if (!ok) return;
    const remaining = docs.filter((d) => d.path !== path);
    setDocs(remaining);
    setLocalOnlyPaths((prev) => prev.filter((p) => p !== path));
    if (active === path) setActive(remaining[0]?.path ?? '');
    setStatus(`deleted local file: ${path}`);
  };

  const resolveConflictUseLocal = async (path: string) => {
    const doc = docs.find((d) => d.path === path);
    if (!doc) return;
    try {
      const latest = await ghApi(cfg, path);
      const res = await ghApi(cfg, path, {
        method: 'PUT',
        body: JSON.stringify({ message: `web: resolve(local) ${path}`, content: b64(doc.content), branch: cfg.branch, sha: latest.sha })
      });
      setDocs((prev) => prev.map((d) => d.path === path ? { ...d, sha: res.content?.sha || latest.sha } : d));
      setConflicts((prev) => prev.filter((c) => c.path !== path));
      setStatus(`conflict resolved with local: ${path}`);
    } catch (e: any) {
      setStatus(`resolve failed: ${e.message}`);
    }
  };

  const resolveConflictUseRemote = async (path: string) => {
    try {
      const file = await ghApi(cfg, path);
      const content = unb64((file.content || '').replace(/\n/g, ''));
      const zone: 'source' | 'wiki' = path.startsWith(cfg.sourcePath) ? 'source' : 'wiki';
      setDocs((prev) => prev.map((d) => d.path === path ? { ...d, content, sha: file.sha, zone } : d));
      setLocalOnlyPaths((prev) => prev.filter((p) => p !== path));
      setConflicts((prev) => prev.filter((c) => c.path !== path));
      setStatus(`conflict resolved with remote: ${path}`);
    } catch (e: any) {
      setStatus(`resolve failed: ${e.message}`);
    }
  };

  const treeItems = useMemo(() => {
    const out: { path: string; depth: number; isFile: boolean }[] = [];
    const dirs = new Set<string>();
    const files = [...docs].map((d) => d.path).sort((a, b) => (fileOrder[a] ?? 999999) - (fileOrder[b] ?? 999999) || a.localeCompare(b));
    for (const file of files) {
      const parts = file.split('/');
      let cur = '';
      parts.forEach((p, i) => {
        cur = cur ? `${cur}/${p}` : p;
        if (i < parts.length - 1 && !dirs.has(cur)) {
          dirs.add(cur);
          out.push({ path: cur, depth: i, isFile: false });
        }
      });
      const hiddenByParent = parts.slice(0, -1).some((_, i) => collapsedFolders.includes(parts.slice(0, i + 1).join('/')));
      if (!hiddenByParent) out.push({ path: file, depth: parts.length - 1, isFile: true });
    }
    return out;
  }, [docs, collapsedFolders, fileOrder]);

  const toggleFolder = (path: string) => setCollapsedFolders((prev) => prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]);

  const moveFile = (path: string, dir: -1 | 1) => {
    const files = treeItems.filter((n) => n.isFile).map((n) => n.path);
    const idx = files.indexOf(path);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= files.length) return;
    const a = files[idx], b = files[next];
    setFileOrder((prev) => {
      const p = { ...prev };
      const oa = p[a] ?? idx;
      const ob = p[b] ?? next;
      p[a] = ob; p[b] = oa;
      return p;
    });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const x = e.clientX;
      const ww = window.innerWidth;
      if (dragging === 'left') setLeftPaneW(Math.max(220, Math.min(520, x - 90)));
      if (dragging === 'right') setRightPaneW(Math.max(220, Math.min(520, ww - x - 40)));
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) {
      setCfgLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<GitHubConfig>;
      setCfg((prev) => ({ ...prev, ...parsed, host: parsed.host || prev.host }));
      const llmRaw = localStorage.getItem(LLM_CFG_KEY);
      if (llmRaw) setLlmCfg((prev) => ({ ...prev, ...(JSON.parse(llmRaw) as Partial<LlmConfig>) }));
      const promptRefRaw = localStorage.getItem(PROMPT_REF_KEY);
      if (promptRefRaw) setPromptRef(promptRefRaw);
      const docsRaw = localStorage.getItem(DOCS_CACHE_KEY);
      if (docsRaw) setDocs(JSON.parse(docsRaw) as Doc[]);
      const localOnlyRaw = localStorage.getItem(LOCAL_ONLY_KEY);
      if (localOnlyRaw) setLocalOnlyPaths(JSON.parse(localOnlyRaw) as string[]);
      setStatus('loaded saved settings');
    } catch {
      setStatus('failed to load saved settings');
    } finally {
      setCfgLoaded(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }, [cfg]);

  useEffect(() => {
    localStorage.setItem(LLM_CFG_KEY, JSON.stringify(llmCfg));
  }, [llmCfg]);

  useEffect(() => {
    localStorage.setItem(PROMPT_REF_KEY, promptRef);
  }, [promptRef]);

  useEffect(() => {
    localStorage.setItem(DOCS_CACHE_KEY, JSON.stringify(docs));
    localStorage.setItem(LOCAL_ONLY_KEY, JSON.stringify(localOnlyPaths));
  }, [docs, localOnlyPaths]);

  useEffect(() => {
    if (!cfgLoaded || didAutoSync.current) return;
    if (!cfg.owner || !cfg.repo || !cfg.token) return;
    didAutoSync.current = true;
    syncFromServer('startup');
  }, [cfgLoaded, cfg.host, cfg.owner, cfg.repo, cfg.branch, cfg.token, cfg.sourcePath, cfg.wikiPath]);

  useEffect(() => {
    setDraftText(activeDoc?.content || '');
    setDirty(false);
  }, [active]);

  useEffect(() => {
    if (!highlightTerm || !editorRef.current || !activeDoc) return;
    const i = activeDoc.content.toLowerCase().indexOf(highlightTerm.toLowerCase());
    if (i < 0) return;
    editorRef.current.focus();
    editorRef.current.setSelectionRange(i, i + highlightTerm.length);
    editorRef.current.scrollTop = Math.max(0, (i / Math.max(activeDoc.content.length, 1)) * editorRef.current.scrollHeight - 80);
  }, [active, highlightTerm, activeDoc?.content]);

  useEffect(() => {
    if (localOnlyPaths.length > 0) setRefreshEnabled(true);
  }, [localOnlyPaths.length]);

  const ask = () => {
    const q = question.trim().toLowerCase();
    const related = q ? docs.filter((d) => d.content.toLowerCase().includes(q) || d.path.toLowerCase().includes(q)) : [];
    setAskMatches(related);
    if (!related.length) return '아직 LLM 모델 연동은 없고, 현재는 문서 검색 기반 답변만 제공합니다.';
    return `현재는 로컬 검색 기반입니다(LLM 미연동).\n검색된 문서: ${related.length}개`;
  };

  const askWithLlm = async () => {
    try {
      const base = ask();
      const answer = await callLlm(`${question}\n\nContext:\n${base}`);
      setStatus(`LLM answered (${llmCfg.provider})`);
      alert(answer.slice(0, 2000));
    } catch (e: any) {
      setStatus(`LLM failed: ${e.message}`);
    }
  };


  const graphNodes: GraphNode[] = docs.filter((d) => d.zone === 'wiki').map((d, i) => {
    const angle = i * 0.55;
    const r = 80 + i * 10;
    return { id: d.path, x: 280 + Math.cos(angle) * r, y: 240 + Math.sin(angle) * r };
  });

  const graphByName = new Map(graphNodes.map((n) => [n.id.split('/').pop()?.replace('.md', ''), n]));

  const graphEdges = graphNodes.flatMap((node) => {
    const doc = docs.find((d) => d.path === node.id);
    if (!doc) return [];
    return parseLinks(doc.content).map((link) => {
      const target = graphByName.get(link.replace('./', '').replace('.md', ''));
      return target ? { from: node, to: target } : null;
    }).filter(Boolean) as { from: GraphNode; to: GraphNode }[];
  });

  const graphSelectedDoc = docs.find((d) => d.path === graphSelected);

  return <div className='app'>
    <aside className='left-nav'>
      <h2>LLM Wiki (Web)</h2>
      {(['files', 'graph', 'askSearch', 'settings'] as Screen[]).map((s) => <button key={s} className={screen === s ? 'on' : ''} onClick={() => setScreen(s)}>{s === 'askSearch' ? 'ask & search' : s}</button>)}
      <small>{status}</small>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => syncFromServer('manual')} disabled={!refreshEnabled || isRefreshing}>{isRefreshing ? 'Refreshing...' : 'Refresh from Server'}</button>
        <button onClick={pushLocalToServer} disabled={localOnlyPaths.length === 0 || isPushing}>{isPushing ? 'Pushing...' : 'Push Local → Server'}</button>
      </div>
    </aside>

    <section className='content'>
      {screen === 'settings' && <section className='settings card'>
        <h3>GitHub Settings (Enterprise 지원)</h3>
        <div className='grid'>
          {(['host', 'owner', 'repo', 'branch', 'token', 'sourcePath', 'wikiPath', 'backupPath'] as (keyof GitHubConfig)[]).map((k) => <label key={k}>{k}
            <input type={k === 'token' ? 'password' : 'text'} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} />
          </label>)}
        </div>
        <h3>LLM Settings</h3>
        <div className='grid'>
          <label>provider
            <select value={llmCfg.provider} onChange={(e) => setLlmCfg({ ...llmCfg, provider: e.target.value as LlmProvider })}>
              <option value='openai'>openai</option>
              <option value='gemini'>gemini</option>
              <option value='gauss'>gauss</option>
            </select>
          </label>
          <label>apiKey
            <input type='password' value={llmCfg.apiKey} onChange={(e) => setLlmCfg({ ...llmCfg, apiKey: e.target.value })} />
          </label>
          <label>model
            <input type='text' value={llmCfg.model} onChange={(e) => setLlmCfg({ ...llmCfg, model: e.target.value })} placeholder={llmCfg.provider === 'openai' ? 'gpt-4.1-mini' : llmCfg.provider === 'gemini' ? 'gemini-1.5-flash' : 'gauss-default'} />
          </label>
        </div>
        <h3>Wiki Prompt Template</h3>
        <div className='grid'>
          <label>reference
            <input type='text' value={promptRef} onChange={(e) => setPromptRef(e.target.value)} />
          </label>
        </div>
        <textarea value={buildWikiPrompt()} readOnly rows={12} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copyPrompt}>Copy Wiki Prompt</button>
        </div>
        <button onClick={saveSettingsAndConnect}>Save Settings & Connect</button>
        <h4>Local backup snapshots</h4>
        <ul>{backups.map((b) => <li key={b.at}>{b.at} ({b.docs.length} docs)</li>)}</ul>
      </section>}

      {screen === 'graph' && <section className='card graph'>
        <h3>Wiki Graph</h3>
        <p>노드를 클릭하면 오른쪽에 해당 문서 내용이 표시됩니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
          <svg width='620' height='520'>
            {graphEdges.map((e, i) => <line key={`e-${i}`} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y} stroke='#777' />)}
            {graphNodes.map((n) => <g key={n.id} onClick={() => setGraphSelected(n.id)} style={{ cursor: 'pointer' }}><circle cx={n.x} cy={n.y} r={graphSelected === n.id ? '22' : '18'} fill={graphSelected === n.id ? '#22c55e' : '#4f46e5'} /><text x={n.x + 22} y={n.y + 4} fill='#ddd' fontSize='12'>{n.id.split('/').pop()}</text></g>)}
          </svg>
          <aside className='card'>
            <h4>{graphSelectedDoc?.path || '선택된 노드 없음'}</h4>
            <ReactMarkdown>{graphSelectedDoc?.content || '그래프 노드를 클릭하면 문서 내용이 여기에 표시됩니다.'}</ReactMarkdown>
          </aside>
        </div>
      </section>}

      {screen === 'askSearch' && <section className='card ask-only'><h3>Ask & Search</h3><p>검색 + LLM 답변(선택 provider) 지원</p><input value={question} onChange={(e) => { setQuestion(e.target.value); }} placeholder='질문/키워드 입력' /><div style={{ marginTop: 8, marginBottom: 8, display: 'flex', gap: 8 }}><button onClick={ask}>Search in Docs</button><button onClick={askWithLlm}>Ask LLM</button></div><pre>{question ? 'Search 또는 Ask LLM 버튼을 눌러 결과를 확인하세요.' : '질문을 입력하세요.'}</pre><h4>검색 결과</h4><ul>{askMatches.map((d) => <li key={d.path}><button onClick={() => { setHighlightTerm(question); setActive(d.path); setScreen('files'); }}>{d.path}</button></li>)}</ul></section>}

      {screen === 'files' && <main className='layout' style={{ display: 'flex', gap: 8 }}>
        <aside className='card' style={{ width: leftPaneW, minWidth: 220, maxWidth: 520 }}><h3>Files</h3>
          <div className='list'>{treeItems.map((n) => n.isFile ? <div key={n.path} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><button className={n.path === active ? 'on' : ''} onClick={() => setActive(n.path)} style={{ marginLeft: n.depth * 12 }}>{n.path.split('/').pop()}{localOnlyPaths.includes(n.path) ? ' (local)' : ''}</button><button onClick={() => moveFile(n.path, -1)}>↑</button><button onClick={() => moveFile(n.path, 1)}>↓</button><button onClick={() => renameFile(n.path)}>✏️</button><button onClick={() => deleteLocalFile(n.path)}>🗑</button></div> : <div key={n.path} style={{ marginLeft: n.depth * 12, opacity: 0.9, display: 'flex', gap: 6, alignItems: 'center' }}><button onClick={() => toggleFolder(n.path)}>{collapsedFolders.includes(n.path) ? '📁' : '📂'} {n.path.split('/').pop()}</button><button onClick={() => createFile(n.path)}>+</button></div>)}</div>
          {conflicts.length > 0 && <div className='card' style={{ marginTop: 8 }}><h4>Conflicts</h4><ul>{conflicts.map((c) => <li key={c.path}><div>{c.path}</div><small>{c.reason}</small><div style={{ display: 'flex', gap: 6 }}><button onClick={() => resolveConflictUseLocal(c.path)}>Use Local</button><button onClick={() => resolveConflictUseRemote(c.path)}>Use Remote</button></div></li>)}</ul></div>}
        </aside>
        <div onMouseDown={() => setDragging('left')} style={{ width: 6, cursor: 'col-resize', background: '#333', borderRadius: 4 }} />
        <section className='card editor' style={{ flex: 1 }}><h3>{activeDoc?.path || '선택된 파일 없음'} {dirty ? '*' : ''}</h3><textarea ref={editorRef} value={draftText} onFocus={() => setHighlightTerm('')} onChange={(e) => { setDirty(true); setDraftText(e.target.value); }} /><div style={{ marginBottom: 8 }}><button onClick={saveLocalEdit} disabled={!dirty}>Save Local</button></div><ReactMarkdown>{draftText || ''}</ReactMarkdown></section>
        <div onMouseDown={() => setDragging('right')} style={{ width: 6, cursor: 'col-resize', background: '#333', borderRadius: 4 }} />
        <aside className='card' style={{ width: rightPaneW, minWidth: 220, maxWidth: 520 }}><h3>Backlinks</h3><ul>{backlinks.map((b) => <li key={b.path}>{b.path}</li>)}</ul></aside>
      </main>}
    </section>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
