export type Doc = { path: string; content: string; zone: 'source' | 'wiki'; sha?: string };
export type Screen = 'files' | 'graph' | 'askSearch' | 'settings';
export type GitHubConfig = {
  host: string;
  owner: string;
  repo: string;
  branch: string;
  token: string;
  sourcePath: string;
  wikiPath: string;
  backupPath: string;
};
export type LlmProvider = 'openai' | 'gemini' | 'gauss';
export type LlmConfig = { provider: LlmProvider; apiKey: string; model: string };
export type ConflictItem = { path: string; reason: string };
export type BackupSnapshot = { at: string; docs: Doc[] };
export type GraphNode = { id: string; x: number; y: number };
