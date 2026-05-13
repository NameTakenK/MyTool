import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('wikiApp', { version: '0.1.0' });
