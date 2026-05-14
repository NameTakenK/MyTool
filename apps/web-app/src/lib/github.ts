import type { Doc, GitHubConfig } from '../types';

export const normalizeHost = (host: string) => host.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
export const getApiBase = (host: string) => normalizeHost(host) === 'github.com' || !normalizeHost(host) ? 'https://api.github.com' : `https://${normalizeHost(host)}/api/v3`;
const normalizeOwner = (owner: string) => owner.trim().replace(/^\/+/, '');
const normalizeRepo = (repo: string) => repo.trim().replace(/^\/+/, '').replace(/\.git$/, '');
const normalizeContentPath = (path: string) => path.split('/').filter(Boolean).map((seg) => encodeURIComponent(seg)).join('/');

export const b64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};
export const unb64 = (text: string) => {
  const binary = atob(text);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export async function ghApi(config: GitHubConfig, path: string, init?: RequestInit) {
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

export async function loadMarkdownTree(config: GitHubConfig, rootPath: string, zone: 'source' | 'wiki'): Promise<Doc[]> {
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
