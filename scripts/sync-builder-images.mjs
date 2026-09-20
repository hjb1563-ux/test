import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = '/images/bathroom-builder/';
const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestName = 'bathroom-builder-image-settings.generated.json';
export function normalizeFilename(filename) {
  return filename.normalize('NFKC').replace(/\.(png|jpe?g|webp)$/i, '')
    .replace(/\(\s*\d+\s*\)/g, '').replace(/(?:-\s*)?복사본/g, '')
    .replace(/\b(?:copy|final)\b/gi, '').replace(/최종/g, '')
    .toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '').trim();
}
export const isProtected = option => option.id === 'other' || option.id === 'undecided' ||
  /모르겠|모르겠음|모르겠어요|상담.*결정/.test(option.name) || option.requiresCustomText;

// Load the real Builder catalog. Ignore only the generated Builder settings so
// the previous run cannot dictate which options are eligible for new photos.
export async function loadOptions(root = projectRoot) {
  const cache = new Map();
  async function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith('.json')) {
      const value = filename.endsWith(manifestName) ? {} : JSON.parse(await fs.readFile(filename, 'utf8'));
      cache.set(filename, value); return value;
    }
    const source = await fs.readFile(filename, 'utf8');
    const dependencies = new Map();
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const resolved = path.resolve(path.dirname(filename), match[1]);
      dependencies.set(match[1], await load(path.extname(resolved) ? resolved : resolved + '.ts'));
    }
    const module = { exports: {} };
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require(name) {
      if (dependencies.has(name)) return dependencies.get(name);
      throw new Error(`Unexpected option dependency: ${name}`);
    } }, { filename, timeout: 5000 });
    cache.set(filename, module.exports); return module.exports;
  }
  const { builderBathroomSteps } = await load(path.join(root, 'data/bathroom-builder-options.ts'));
  return builderBathroomSteps.flatMap((step, index) => step.groups.flatMap(group =>
    group.choices.map(option => ({ ...option, key: `${group.key}:${option.id}`, group: group.title, groupKey: group.key, step: index + 1 }))));
}
const ids = value => Array.isArray(value) ? value : [value];
const aliasCandidates = (map, name) => Object.entries(map ?? {}).filter(([label]) => normalizeFilename(label) === name).flatMap(([, key]) => ids(key));
function findCandidates(name, options, aliases) {
  for (const candidates of [
    options.filter(o => normalizeFilename(o.name) === name).map(o => o.key),
    aliasCandidates(aliases.exact, name),
    aliasCandidates(aliases.keywords, name),
    aliasCandidates(aliases.synonyms, name),
  ]) if (candidates.length) return [...new Set(candidates)];
  return [];
}
export function matchFilename(filename, options, aliases = {}) {
  const name = normalizeFilename(path.basename(filename));
  let candidates = findCandidates(name, options, aliases), version = 1, base = name;
  // Exact dimension names are evaluated first; their last dimension is never a version.
  if (!candidates.length) {
    const known = [...options.map(o => o.name), ...Object.keys(aliases.exact ?? {}), ...Object.keys(aliases.keywords ?? {}), ...Object.keys(aliases.synonyms ?? {})]
      .map(normalizeFilename).filter(label => name.startsWith(label) && /^\d+$/.test(name.slice(label.length)))
      .sort((a, b) => b.length - a.length);
    if (known.length) { base = known[0]; candidates = findCandidates(base, options, aliases); version = Number(name.slice(base.length)); }
  }
  if (!candidates.length) return { status: 'UNMATCHED', version, base };
  if (candidates.every(key => options.some(o => o.key === key && isProtected(o)))) return { status: 'SKIPPED_NO_IMAGE', candidates, version, base };
  if (candidates.length > 1) return { status: 'AMBIGUOUS', candidates, version, base,
    candidateLabels: candidates.map(key => { const o = options.find(o => o.key === key); return o ? `${o.group} / ${o.name}` : key; }) };
  const option = options.find(o => o.key === candidates[0]);
  if (!option) return { status: 'OPTION_NOT_FOUND', candidates, version, base };
  return { status: isProtected(option) ? 'SKIPPED_NO_IMAGE' : 'MATCHED', option, version, base };
}
function correctFormat(bytes, extension) {
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}
async function optionalJSON(file, fallback = {}) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; } }
async function writeJSON(file, value) {
  const content = JSON.stringify(value, null, 2) + '\n';
  let previous; try { previous = await fs.readFile(file, 'utf8'); } catch(e) { if (e.code !== 'ENOENT') throw e; }
  if (content !== previous) await fs.writeFile(file, content);
}
async function scan(directory, relative = '') {
  const files = [];
  for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = relative + entry.name;
    if (entry.isDirectory()) files.push(...await scan(directory, name + '/'));
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(name);
  }
  return files.sort((a, b) => a.localeCompare(b, 'ko'));
}
const urlFor = file => prefix + file.split('/').map(part => encodeURIComponent(part)).join('/');
const stem = url => decodeURIComponent(url).replace(/\.[^/.]+$/, '').toLowerCase();

export async function syncImages({ root = projectRoot, options, aliases } = {}) {
  options ??= await loadOptions(root);
  aliases ??= await optionalJSON(path.join(root, 'data/bathroom-builder-image-aliases.json'));
  const baseDir = path.join(root, 'public/images/bathroom-builder');
  const manifestPath = path.join(root, 'data', manifestName);
  const previous = await optionalJSON(manifestPath);
  const files = await scan(baseDir), results = [];
  for (const file of files) {
    if (file.startsWith('archive/') || normalizeFilename(path.basename(file)) === 'placeholder') {
      results.push({ file, status: 'IGNORED', reason: 'archive or placeholder' }); continue;
    }
    const url = urlFor(file);
    let match = matchFilename(file, options, aliases);
    // Existing canonical paths have directory context (e.g. basin/standard vs bathtub/standard).
    if (match.status === 'UNMATCHED') {
      const candidates = options.filter(o => o.builderImage && stem(o.builderImage) === stem(url));
      if (candidates.length === 1) match = { status: isProtected(candidates[0]) ? 'SKIPPED_NO_IMAGE' : 'MATCHED', option: candidates[0], version: 1, base: stem(url) };
      else if (candidates.length > 1) match = { status: 'AMBIGUOUS', candidates: candidates.map(o => o.key) };
    }
    const row = { file, url, ...match };
    if (row.status === 'MATCHED') {
      const bytes = await fs.readFile(path.join(baseDir, file));
      if (!correctFormat(bytes, path.extname(file).toLowerCase())) row.status = 'INVALID_FORMAT';
      else row.hash = digest(bytes);
    }
    results.push(row);
  }
  const settings = {}, changes = [];
  for (const option of options) {
    const old = previous[option.key] ?? { builderImage: option.builderImage, showBuilderImage: option.showBuilderImage };
    const candidates = results.filter(r => r.status === 'MATCHED' && r.option.key === option.key);
    let chosen;
    if (!isProtected(option) && candidates.length) {
      const highest = Math.max(...candidates.map(r => r.version));
      const latest = candidates.filter(r => r.version === highest);
      if (latest.every(r => r.hash === latest[0].hash)) {
        chosen = latest.find(r => r.url === old.builderImage) ?? latest[0];
      } else {
        for (const row of latest) { row.status = 'AMBIGUOUS'; row.candidates = latest.map(r => r.file); }
        // Keep a previously selected valid file; never pick arbitrarily among tied new versions.
        chosen = candidates.find(r => r.url === old.builderImage);
      }
      for (const row of candidates) if (row.version < highest) row.status = 'OLDER_VERSION';
    }
    const next = chosen ? { builderImage: chosen.url, showBuilderImage: true } : { builderImage: null, showBuilderImage: false };
    settings[option.key] = next;
    const action = next.showBuilderImage ? !old.showBuilderImage || !results.some(r => r.url === old.builderImage && r.hash) ? 'NEW IMAGE'
      : old.builderImage === next.builderImage ? 'UNCHANGED' : 'UPDATED' : old.showBuilderImage ? 'DISABLED' : 'UNCHANGED';
    changes.push({ key: option.key, name: option.name, category: option.group, action, previous: old, next });
  }
  await writeJSON(manifestPath, settings);
  const report = { total: files.length, matchedFiles: results.filter(r => r.option && ['MATCHED', 'OLDER_VERSION'].includes(r.status)).length,
    newImages: changes.filter(c => c.action === 'NEW IMAGE').length, updatedImages: changes.filter(c => c.action === 'UPDATED').length,
    unmatched: results.filter(r => ['UNMATCHED', 'OPTION_NOT_FOUND'].includes(r.status)).length,
    ambiguous: results.filter(r => r.status === 'AMBIGUOUS').length, files: results, changes };
  await writeJSON(path.join(root, 'data/bathroom-builder-image-sync-report.json'), {
    ...report,
    files: results.map(({ file, status, url, option, candidates, candidateLabels }) => ({ file, status, url, option: option?.key, candidates, candidateLabels })),
  });
  // Only selected inbox originals need to be included in a Git/Vercel checkout.
  const ignorePath = path.join(root, '.gitignore');
  let ignore = ''; try { ignore = await fs.readFile(ignorePath, 'utf8'); } catch(e) { if (e.code !== 'ENOENT') throw e; }
  const marker = '# BEGIN builder image sources';
  const endMarker = '# END builder image sources';
  const selected = [...new Set(Object.values(settings).filter(s => s.showBuilderImage).map(s => decodeURIComponent(s.builderImage)).filter(url => url.startsWith(prefix + 'inbox/')))];
  const escapeGlob = value => value.replace(/([*?\[\]\\])/g, '\\$1');
  const block = [marker, '!public/images/bathroom-builder/inbox/**/', ...selected.sort().map(url => '!' + escapeGlob('public' + url)), endMarker].join('\n');
  const nextIgnore = ignore.includes(marker) ? ignore.replace(new RegExp(marker + '[\\s\\S]*?' + endMarker), block) : ignore.trimEnd() + '\n\n' + block + '\n';
  if (ignore !== nextIgnore) await fs.writeFile(ignorePath, nextIgnore);
  return report;
}
export function printReport(report) {
  console.log(`IMAGE SCAN: ${report.total}; MATCHED: ${report.matchedFiles}; NEW IMAGE: ${report.newImages}; UPDATED: ${report.updatedImages}; UNMATCHED: ${report.unmatched}; AMBIGUOUS: ${report.ambiguous}`);
  for (const action of ['UPDATED', 'NEW IMAGE', 'DISABLED', 'UNCHANGED']) {
    const rows = report.changes.filter(c => c.action === action && (action !== 'UNCHANGED' || c.next.showBuilderImage));
    console.log(`\n${action}: ${rows.length}`);
    for (const row of rows) console.log(`  ${row.category} / ${row.name}\n    ${decodeURI(row.previous.builderImage ?? '(none)')} -> ${decodeURI(row.next.builderImage ?? '(none)')}\n    showBuilderImage: ${row.previous.showBuilderImage} -> ${row.next.showBuilderImage}`);
  }
  for (const status of ['UNMATCHED', 'OPTION_NOT_FOUND', 'AMBIGUOUS', 'OLDER_VERSION', 'SKIPPED_NO_IMAGE', 'INVALID_FORMAT', 'IGNORED']) {
    const rows = report.files.filter(r => r.status === status); console.log(`\n${status}: ${rows.length}`);
    for (const row of rows) console.log(`  ${row.file}${row.candidates ? ' / candidates: ' + (row.candidateLabels ?? row.candidates).join(', ') : ''}`);
  }
  console.log('\nImage files were not moved, renamed, copied, deleted or re-encoded.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncImages().then(printReport).catch(error => { console.error(error); process.exitCode = 1; });
}
