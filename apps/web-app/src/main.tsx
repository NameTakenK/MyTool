import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import './styles.css';

type Doc = { path: string; content: string };

const docs: Doc[] = [
  { path: 'docs/llm-wiki/index.md', content: '# Index\n\n[[architecture]]\n[[api/authentication]]' },
  { path: 'docs/llm-wiki/architecture.md', content: '# Architecture\n\n[Auth](./api/authentication.md)' },
  { path: 'docs/llm-wiki/api/authentication.md', content: '# Authentication\n\nPAT token for GitHub sync.' }
];

const systemPrompt = `You are a repository wiki assistant.\n\nAnswer only using the provided wiki context.\n\nIf the answer is not present in the context, say:\n"현재 Wiki 문서 기준으로는 확인할 수 없습니다."\n\nAlways cite the source markdown files used.\n\nDo not invent repository behavior.`;

const parseLinks = (text: string) => [
  ...[...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]),
  ...[...text.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)].map((m) => m[1])
];

function App() {
  const [active, setActive] = useState(docs[0].path);
  const [question, setQuestion] = useState('');
  const activeDoc = docs.find((d) => d.path === active) ?? docs[0];

  const backlinks = useMemo(
    () => docs.filter((d) => d.path !== active && parseLinks(d.content).some((l) => active.includes(l.replace('./', '')))),
    [active]
  );

  const ask = () => {
    const related = docs.filter((d) => d.content.toLowerCase().includes(question.toLowerCase()));
    if (!related.length) return '현재 Wiki 문서 기준으로는 확인할 수 없습니다.';
    return related.map((d) => `- ${d.path}`).join('\n');
  };

  return <div className='layout'>
    <aside><h3>Files</h3>{docs.map((d)=><button key={d.path} onClick={()=>setActive(d.path)}>{d.path}</button>)}</aside>
    <main><h2>{activeDoc.path}</h2><ReactMarkdown>{activeDoc.content}</ReactMarkdown></main>
    <aside><h3>Backlinks</h3><ul>{backlinks.map((b)=><li key={b.path}>{b.path}</li>)}</ul></aside>
    <footer>
      <h3>Ask Wiki</h3>
      <small>{systemPrompt}</small>
      <input value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder='Ask...' />
      <pre>{ask()}</pre>
    </footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
