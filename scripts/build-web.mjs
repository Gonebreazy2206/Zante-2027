import { cpSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const www = resolve(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

copyFileSync(resolve(root, 'index.html'), resolve(www, 'index.html'));
cpSync(resolve(root, 'css'), resolve(www, 'css'), { recursive: true });
cpSync(resolve(root, 'js'), resolve(www, 'js'), { recursive: true });

console.log('Web app copied to www/');
