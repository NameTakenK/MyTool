import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import './styles.css';

const sample = `# LLM Wiki\n\n[[architecture]]\n\n[Auth](../api/authentication.md)`;

function parseLinks(content: string) {
  const wiki = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
  const md = [...content.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)].map((m) => m[1]);
  return [...new Set([...wiki, ...md])];
}

function App() {
  const links = parseLinks(sample);
  return <div className='layout'>
    <aside><h3>Repo/Tree/Search</h3><button>New Markdown</button><button>Upload Markdown</button></aside>
    <main><h2>Editor + Preview</h2><textarea defaultValue={sample}/><ReactMarkdown>{sample}</ReactMarkdown></main>
    <aside><h3>Backlinks</h3><ul>{links.map((l)=><li key={l}>{l}</li>)}</ul></aside>
    <footer><h3>Graph / Q&A / Sync Log</h3><p>Force graph + Q&A panel placeholder</p></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
