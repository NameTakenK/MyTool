import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import './styles.css';

type Doc = { path: string; content: string };
type GitHubConfig = { owner: string; repo: string; branch: string; token: string; wikiPath: string };

const initialDocs: Doc[] = [
  { path: 'docs/llm-wiki/index.md', content: '# Index\n\n[[architecture]]\n[[api/authentication]]' },
  { path: 'docs/llm-wiki/architecture.md', content: '# Architecture\n\n[Auth](./api/authentication.md)' },
  { path: 'docs/llm-wiki/api/authentication.md', content: '# Authentication\n\nPAT token for GitHub sync.' }
];

const parseLinks = (text: string) => [
  ...[...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]),
  ...[...text.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)].map((m) => m[1])
];

function App() {
  const [docs, setDocs] = useState(initialDocs);
  const [active, setActive] = useState(docs[0].path);
  const [question, setQuestion] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'wiki' | 'settings'>('wiki');
  const [gitHubConfig, setGitHubConfig] = useState<GitHubConfig>({ owner: '', repo: '', branch: 'main', token: '', wikiPath: 'docs/llm-wiki' });
  const activeDoc = docs.find((d) => d.path === active) ?? docs[0];

  const filteredDocs = useMemo(() => docs.filter((d) => d.path.toLowerCase().includes(search.toLowerCase())), [docs, search]);
  const backlinks = useMemo(() => docs.filter((d) => d.path !== active && parseLinks(d.content).some((l) => active.includes(l.replace('./', '')))), [docs, active]);

  const ask = () => {
    const related = docs.filter((d) => d.content.toLowerCase().includes(question.toLowerCase()));
    if (!related.length) return '현재 Wiki 문서 기준으로는 확인할 수 없습니다.';
    return `답변 근거 문서:\n${related.map((d) => `- ${d.path}`).join('\n')}`;
  };

  const updateDoc = (content: string) => {
    setDocs((prev) => prev.map((d) => (d.path === active ? { ...d, content } : d)));
  };

  return <div className='app'>
    <header className='topbar'>
      <h1>LLM Wiki Web</h1>
      <nav>
        <button className={tab==='wiki'?'on':''} onClick={()=>setTab('wiki')}>Wiki</button>
        <button className={tab==='settings'?'on':''} onClick={()=>setTab('settings')}>GitHub 설정</button>
      </nav>
    </header>

    {tab === 'settings' ? <section className='settings card'>
      <h2>GitHub 설정은 여기서 합니다</h2>
      <div className='grid'>
        {(['owner','repo','branch','token','wikiPath'] as (keyof GitHubConfig)[]).map((key)=><label key={key}>{key}
          <input type={key==='token'?'password':'text'} value={gitHubConfig[key]} onChange={(e)=>setGitHubConfig({...gitHubConfig, [key]: e.target.value})} />
        </label>)}
      </div>
      <p className='hint'>현재는 MVP라 브라우저 메모리에만 저장됩니다. 실제 저장은 keychain/secure storage 연동 단계에서 구현합니다.</p>
    </section> : <main className='layout'>
      <aside className='card'>
        <h3>Vault</h3>
        <input placeholder='Search markdown...' value={search} onChange={(e)=>setSearch(e.target.value)} />
        <div className='list'>{filteredDocs.map((d)=><button key={d.path} className={d.path===active?'on':''} onClick={()=>setActive(d.path)}>{d.path}</button>)}</div>
      </aside>

      <section className='card editor'>
        <h3>입력은 여기서 합니다 (Markdown Editor)</h3>
        <textarea value={activeDoc.content} onChange={(e)=>updateDoc(e.target.value)} />
        <h4>Preview</h4>
        <ReactMarkdown>{activeDoc.content}</ReactMarkdown>
      </section>

      <aside className='card'>
        <h3>Backlinks</h3>
        <ul>{backlinks.map((b)=><li key={b.path}>{b.path}</li>)}</ul>
        <h3>Outgoing Links</h3>
        <ul>{parseLinks(activeDoc.content).map((l)=><li key={l}>{l}</li>)}</ul>
        <h3>Metadata</h3>
        <ul><li>Path: {activeDoc.path}</li><li>Type: markdown</li></ul>
      </aside>

      <footer className='card ask'>
        <h3>Ask Wiki</h3>
        <input value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder='질문 입력...' />
        <pre>{question ? ask() : '질문을 입력하세요.'}</pre>
      </footer>
    </main>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
