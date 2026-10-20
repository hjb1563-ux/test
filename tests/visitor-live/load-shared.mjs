// This directory must never be imported by app/, components/ or server/.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const Module = require('node:module'), ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function loadShared() {
  if (!process.execArgv.some(v => v === '--conditions=react-server' || v === '--conditions=react-server,node')) throw new Error('server-condition-required');
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (!['visitor-core.ts','visitor-rpc.ts'].some(name => file === path.join(root, 'server', name))) throw new Error('module-not-allowed');
    if (cache.has(file)) return cache.get(file).exports;
    const m = new Module(file); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(file,m);
    m.require = name => name === 'server-only' ? require(path.resolve(path.dirname(require.resolve('next/dist/compiled/server-only/package.json')), require('next/dist/compiled/server-only/package.json').exports['.']['react-server'])) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
    // Preserve server-only; Node's explicit react-server condition resolves its genuine server export.
    m._compile(ts.transpileModule(readFileSync(file,'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText,file);
    return m.exports;
  }
  return { ...load(path.join(root,'server/visitor-core.ts')), ...load(path.join(root,'server/visitor-rpc.ts')) };
}
