import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import './styles.css';

type Doc = { path: string; content: string; zone: 'source' | 'wiki' };
type Screen = 'files' | 'graph' | 'askSearch' | 'settings';
type GitHubConfig = {
  host: string;
  owner: string; repo: string; branch: string; token: string;
  sourcePath: string; wikiPath: string; backupPath: string;
};
type BackupSnapshot = { at: string; docs: Doc[] };
type GraphNode = { id: string; x: number; y: number };
type NewFileZone = 'source' | 'wiki';

const CFG_KEY = 'llm-wiki-github-config';
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
      docs.push({ path: item.path, content: unb64((file.content || '').replace(/\n/g, '')), zone });
    }
  }
  return docs;
}

function App() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [active, setActive] = useState('');
  const [question, setQuestion] = useState('');
  const [askMatches, setAskMatches] = useState<Doc[]>([]);
  const [search, setSearch] = useState('');
  const [screen, setScreen] = useState<Screen>('files');
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [status, setStatus] = useState('연결 필요');
  const [connected, setConnected] = useState(false);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [newFileName, setNewFileName] = useState('new-note.md');
  const [newFileZone, setNewFileZone] = useState<NewFileZone>('source');
  const [dirty, setDirty] = useState(false);
  const [localOnlyPaths, setLocalOnlyPaths] = useState<string[]>([]);
  const [cfg, setCfg] = useState<GitHubConfig>({
    host: 'github.com', owner: '', repo: '', branch: 'main', token: '',
    sourcePath: 'docs/source', wikiPath: 'docs/llm-wiki', backupPath: 'docs/backups'
  });
  const didAutoSync = useRef(false);

  const activeDoc = docs.find((d) => d.path === active) ?? docs[0];
  const filteredDocs = useMemo(() => docs.filter((d) => d.path.toLowerCase().includes(search.toLowerCase())), [docs, search]);
  const backlinks = useMemo(() => docs.filter((d) => d.path !== active && parseLinks(d.content).some((l) => active.includes(l.replace('./', '')))), [docs, active]);

  const syncFromServer = async (trigger: 'startup' | 'manual') => {
    if (!cfg.host || !cfg.owner || !cfg.repo || !cfg.token) {
      setConnected(false);
      setStatus('config required: host/owner/repo/token');
      return;
    }
    setStatus(`syncing (${trigger})`);
    setBackups((prev) => [{ at: new Date().toISOString(), docs: structuredClone(docs) }, ...prev].slice(0, 20));
    try {
      const sourceDocs = await loadMarkdownTree(cfg, cfg.sourcePath, 'source');
      const wikiDocs = await loadMarkdownTree(cfg, cfg.wikiPath, 'wiki');
      const remoteMerged = [...sourceDocs, ...wikiDocs];
      const localOnlyDocs = docs.filter((d) => localOnlyPaths.includes(d.path));
      const merged = [...remoteMerged, ...localOnlyDocs.filter((local) => !remoteMerged.some((r) => r.path === local.path))];
      setDocs(merged);
      setActive(merged[0]?.path ?? '');
      setConnected(true);
      setStatus(`synced (${trigger})`);
    } catch (e: any) {
      setConnected(false);
      setStatus(`sync failed: ${e.message}`);
    }
  };

  const saveSettingsAndConnect = async () => {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    setStatus('settings saved');
    await syncFromServer('manual');
  };

  const createFile = () => {
    if (!newFileName.endsWith('.md')) return setStatus('file must end with .md');
    const safe = newFileName.replace(/^\/+/, '').replace(/\.\./g, '').trim();
    if (!safe) return setStatus('invalid file name');
    const root = newFileZone === 'source' ? cfg.sourcePath : cfg.wikiPath;
    const path = `${root}/${safe}`;
    if (docs.some((d) => d.path === path)) return setStatus('file already exists');
    const newDoc: Doc = { path, content: `# ${safe.replace('.md', '')}\n`, zone: newFileZone };
    setDocs((prev) => [newDoc, ...prev]);
    setLocalOnlyPaths((prev) => Array.from(new Set([...prev, path])));
    setActive(path);
    setStatus(`created local file: ${path}`);
  };

  const saveActiveToGitHub = async () => {
    if (!connected || !activeDoc) return setStatus('connect first');
    try {
      let sha: string | undefined;
      try { sha = (await ghApi(cfg, activeDoc.path)).sha; } catch { sha = undefined; }
      await ghApi(cfg, activeDoc.path, {
        method: 'PUT',
        body: JSON.stringify({
          message: `web: save ${activeDoc.path}`,
          content: b64(activeDoc.content),
          branch: cfg.branch,
          sha
        })
      });
      setStatus(`saved to github: ${activeDoc.path}`);
      setLocalOnlyPaths((prev) => prev.filter((p) => p !== activeDoc.path));
      setDirty(false);
      await syncFromServer('manual');
    } catch (e: any) {
      setStatus(`save failed: ${e.message}`);
    }
  };

  const deleteActiveFromGitHub = async () => {
    if (!connected || !activeDoc) return setStatus('connect first');
    const ok = window.confirm(`Delete ${activeDoc.path} from GitHub?`);
    if (!ok) return;
    try {
      const existing = await ghApi(cfg, activeDoc.path);
      await ghApi(cfg, activeDoc.path, {
        method: 'DELETE',
        body: JSON.stringify({
          message: `web: delete ${activeDoc.path}`,
          branch: cfg.branch,
          sha: existing.sha
        })
      });
      setStatus(`deleted from github: ${activeDoc.path}`);
      const remaining = docs.filter((d) => d.path !== activeDoc.path);
      setDocs(remaining);
      setLocalOnlyPaths((prev) => prev.filter((p) => p !== activeDoc.path));
      setActive(remaining[0]?.path ?? '');
      setDirty(false);
      await syncFromServer('manual');
    } catch (e: any) {
      setStatus(`delete failed: ${e.message}`);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) {
      setCfgLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<GitHubConfig>;
      setCfg((prev) => ({ ...prev, ...parsed, host: parsed.host || prev.host }));
      setStatus('loaded saved settings');
    } catch {
      setStatus('failed to load saved settings');
    } finally {
      setCfgLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!cfgLoaded || didAutoSync.current) return;
    if (!cfg.owner || !cfg.repo || !cfg.token) return;
    didAutoSync.current = true;
    syncFromServer('startup');
  }, [cfgLoaded, cfg.host, cfg.owner, cfg.repo, cfg.branch, cfg.token, cfg.sourcePath, cfg.wikiPath]);

  useEffect(() => {
    setDirty(false);
  }, [active]);

  const ask = () => {
    const q = question.trim().toLowerCase();
    const related = q ? docs.filter((d) => d.content.toLowerCase().includes(q) || d.path.toLowerCase().includes(q)) : [];
    setAskMatches(related);
    if (!related.length) return '아직 LLM 모델 연동은 없고, 현재는 문서 검색 기반 답변만 제공합니다.';
    return `현재는 로컬 검색 기반입니다(LLM 미연동).\n검색된 문서: ${related.length}개`;
  };


  const graphNodes: GraphNode[] = docs.filter((d) => d.zone === 'wiki').map((d, i, arr) => {
    const angle = (2 * Math.PI * i) / Math.max(arr.length, 1);
    return { id: d.path, x: 250 + Math.cos(angle) * 180, y: 220 + Math.sin(angle) * 180 };
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

  return <div className='app'>
    <aside className='left-nav'>
      <h2>LLM Wiki (Web)</h2>
      {(['files', 'graph', 'askSearch', 'settings'] as Screen[]).map((s) => <button key={s} className={screen === s ? 'on' : ''} onClick={() => setScreen(s)}>{s === 'askSearch' ? 'ask & search' : s}</button>)}
      <button onClick={() => syncFromServer('manual')}>Sync</button>
      <small>{status}</small>
    </aside>

    <section className='content'>
      {screen === 'settings' && <section className='settings card'>
        <h3>GitHub Settings (Enterprise 지원)</h3>
        <div className='grid'>
          {(['host', 'owner', 'repo', 'branch', 'token', 'sourcePath', 'wikiPath', 'backupPath'] as (keyof GitHubConfig)[]).map((k) => <label key={k}>{k}
            <input type={k === 'token' ? 'password' : 'text'} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} />
          </label>)}
        </div>
        <button onClick={saveSettingsAndConnect}>Save Settings & Connect</button>
        <h4>Local backup snapshots</h4>
        <ul>{backups.map((b) => <li key={b.at}>{b.at} ({b.docs.length} docs)</li>)}</ul>
      </section>}

      {screen === 'graph' && <section className='card graph'>
        <h3>Wiki Graph</h3>
        <p>텍스트 목록이 아니라 노드/엣지 형태로 표시합니다.</p>
        <svg width='520' height='460'>
          {graphEdges.map((e, i) => <line key={`e-${i}`} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y} stroke='#999' />)}
          {graphNodes.map((n) => <g key={n.id}><circle cx={n.x} cy={n.y} r='18' fill='#4f46e5' /><text x={n.x + 22} y={n.y + 4} fill='#ddd' fontSize='12'>{n.id.split('/').pop()}</text></g>)}
        </svg>
      </section>}

      {screen === 'askSearch' && <section className='card ask-only'><h3>Ask & Search</h3><p>현재는 LLM 모델 연동 전 단계입니다. 문서 검색 기반으로 답합니다.</p><input value={question} onChange={(e) => { setQuestion(e.target.value); }} placeholder='질문/키워드 입력' /><div style={{ marginTop: 8, marginBottom: 8 }}><button onClick={ask}>Search in Docs</button></div><pre>{question ? 'Search 버튼을 눌러 결과를 확인하세요.' : '질문을 입력하세요.'}</pre><h4>검색 결과</h4><ul>{askMatches.map((d) => <li key={d.path}><button onClick={() => { setActive(d.path); setScreen('files'); }}>{d.path}</button></li>)}</ul></section>}

      {screen === 'files' && <main className='layout'>
        <aside className='card'><h3>Files (연동 후 표시)</h3><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search' />
          <small>local only: {localOnlyPaths.length} (Save to GitHub 전까지 Sync해도 유지)</small>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select value={newFileZone} onChange={(e) => setNewFileZone(e.target.value as NewFileZone)}>
              <option value='source'>source</option>
              <option value='wiki'>wiki</option>
            </select>
            <input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder='new-note.md' />
            <button onClick={createFile}>New .md</button>
          </div>
          <div className='list'>{filteredDocs.map((d) => <button key={d.path} className={d.path === active ? 'on' : ''} onClick={() => setActive(d.path)}>{d.zone} | {d.path}{localOnlyPaths.includes(d.path) ? ' (local)' : ''}</button>)}</div></aside>
        <section className='card editor'><h3>{activeDoc?.path || '선택된 파일 없음'} {dirty ? '*' : ''}</h3><textarea value={activeDoc?.content || ''} onChange={(e) => { setDirty(true); setDocs(prev => prev.map(d => d.path === active ? { ...d, content: e.target.value } : d)); }} /><div style={{ marginBottom: 8, display: 'flex', gap: 8 }}><button onClick={saveActiveToGitHub}>Save to GitHub</button><button onClick={deleteActiveFromGitHub}>Delete from GitHub</button></div><ReactMarkdown>{activeDoc?.content || ''}</ReactMarkdown></section>
        <aside className='card'><h3>Backlinks</h3><ul>{backlinks.map((b) => <li key={b.path}>{b.path}</li>)}</ul></aside>
      </main>}
    </section>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
