import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import './styles.css';

type Doc = { path: string; content: string; zone: 'source' | 'wiki' };
type Screen = 'files' | 'graph' | 'ask' | 'settings';
type GitHubConfig = {
  owner: string; repo: string; branch: string; token: string;
  sourcePath: string; wikiPath: string; backupPath: string;
};
type BackupSnapshot = { at: string; docs: Doc[] };

const sampleDocs: Doc[] = [
  { path: 'docs/source/note.md', content: '# Source Note', zone: 'source' },
  { path: 'docs/llm-wiki/index.md', content: '# Wiki Index\n\n[[architecture]]', zone: 'wiki' }
];

const parseLinks = (text: string) => [
  ...[...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]),
  ...[...text.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)].map((m) => m[1])
];

async function ghApi(config: GitHubConfig, path: string) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function loadMarkdownTree(config: GitHubConfig, rootPath: string, zone: 'source' | 'wiki'): Promise<Doc[]> {
  const list = await ghApi(config, rootPath);
  const arr = Array.isArray(list) ? list : [list];
  const docs: Doc[] = [];
  for (const item of arr) {
    if (item.type === 'dir') docs.push(...await loadMarkdownTree(config, item.path, zone));
    else if (item.type === 'file' && item.name.endsWith('.md')) {
      const file = await ghApi(config, item.path);
      const content = atob((file.content || '').replace(/\n/g, ''));
      docs.push({ path: item.path, content, zone });
    }
  }
  return docs;
}

function App() {
  const [docs, setDocs] = useState<Doc[]>(sampleDocs);
  const [active, setActive] = useState(sampleDocs[0].path);
  const [question, setQuestion] = useState('');
  const [search, setSearch] = useState('');
  const [screen, setScreen] = useState<Screen>('files');
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [status, setStatus] = useState('idle');
  const [cfg, setCfg] = useState<GitHubConfig>({
    owner: '', repo: '', branch: 'main', token: '', sourcePath: 'docs/source', wikiPath: 'docs/llm-wiki', backupPath: 'docs/backups'
  });

  const activeDoc = docs.find((d) => d.path === active) ?? docs[0];
  const filteredDocs = useMemo(() => docs.filter((d) => d.path.toLowerCase().includes(search.toLowerCase())), [docs, search]);
  const backlinks = useMemo(() => docs.filter((d) => d.path !== active && parseLinks(d.content).some((l) => active.includes(l.replace('./', '')))), [docs, active]);

  const syncFromServer = async (trigger: 'startup' | 'reload' | 'manual') => {
    if (!cfg.owner || !cfg.repo || !cfg.token) return;
    setStatus(`syncing (${trigger})`);
    setBackups((prev) => [{ at: new Date().toISOString(), docs: structuredClone(docs) }, ...prev].slice(0, 20));
    try {
      const sourceDocs = await loadMarkdownTree(cfg, cfg.sourcePath, 'source');
      const wikiDocs = await loadMarkdownTree(cfg, cfg.wikiPath, 'wiki');
      const merged = [...sourceDocs, ...wikiDocs];
      setDocs(merged);
      setActive(merged[0]?.path ?? '');
      setStatus(`synced (${trigger})`);
    } catch (e: any) {
      setStatus(`sync failed: ${e.message}`);
    }
  };

  useEffect(() => { syncFromServer('startup'); /* server wins */ }, []);

  const ask = () => {
    const related = docs.filter((d) => d.content.toLowerCase().includes(question.toLowerCase()));
    if (!related.length) return '현재 Wiki 문서 기준으로는 확인할 수 없습니다.';
    return `답변 근거 문서:\n${related.map((d) => `- ${d.path}`).join('\n')}`;
  };

  return <div className='app'>
    <aside className='left-nav'>
      <h2>LLM Wiki</h2>
      {(['files','graph','ask','settings'] as Screen[]).map((s)=><button key={s} className={screen===s?'on':''} onClick={()=>setScreen(s)}>{s}</button>)}
      <button onClick={()=>syncFromServer('manual')}>Sync (Server Wins)</button>
      <small>{status}</small>
    </aside>

    <section className='content'>
      {screen === 'settings' && <section className='settings card'>
        <h3>GitHub Settings</h3>
        <div className='grid'>
          {(['owner','repo','branch','token','sourcePath','wikiPath','backupPath'] as (keyof GitHubConfig)[]).map((k)=><label key={k}>{k}
            <input type={k==='token'?'password':'text'} value={cfg[k]} onChange={(e)=>setCfg({...cfg, [k]: e.target.value})}/>
          </label>)}
        </div>
        <h4>Local backup snapshots</h4>
        <ul>{backups.map((b)=><li key={b.at}>{b.at} ({b.docs.length} docs)</li>)}</ul>
      </section>}

      {screen === 'graph' && <section className='card graph'><h3>Wiki Graph (wiki zone)</h3><ul>{docs.filter(d=>d.zone==='wiki').map((d)=><li key={d.path}>{d.path} → {parseLinks(d.content).join(', ')||'(none)'}</li>)}</ul></section>}
      {screen === 'ask' && <section className='card ask-only'><h3>Ask Wiki</h3><input value={question} onChange={(e)=>setQuestion(e.target.value)} /><pre>{question?ask():'질문을 입력하세요.'}</pre></section>}

      {screen === 'files' && <main className='layout'>
        <aside className='card'><h3>Files (source + wiki)</h3><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder='Search'/><div className='list'>{filteredDocs.map((d)=><button key={d.path} className={d.path===active?'on':''} onClick={()=>setActive(d.path)}>{d.zone} | {d.path}</button>)}</div></aside>
        <section className='card editor'><h3>{activeDoc?.path}</h3><textarea value={activeDoc?.content||''} onChange={(e)=>setDocs(prev=>prev.map(d=>d.path===active?{...d, content:e.target.value}:d))}/><ReactMarkdown>{activeDoc?.content||''}</ReactMarkdown></section>
        <aside className='card'><h3>Backlinks</h3><ul>{backlinks.map((b)=><li key={b.path}>{b.path}</li>)}</ul></aside>
      </main>}
    </section>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
