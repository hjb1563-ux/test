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

export function normalizeFilename(filename) {
  return filename.normalize('NFKC').replace(/\.(png|jpe?g|webp)$/i, '')
    .replace(/\(\s*\d+\s*\)/g, '').replace(/(?:-\s*)?복사본/g, '')
    .replace(/\b(?:copy|final)\b/gi, '').replace(/최종/g, '')
    .toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '').trim();
}

// Evaluate the actual option catalog, with an empty image manifest, to obtain
// stable canonical filenames. No second copy of the option catalog is maintained.
export async function loadOptions(root = projectRoot) {
  const filename = path.join(root, 'data/bathroom-options.ts');
  const source = await fs.readFile(filename, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name === './bathroom-builder-images.generated.json') return {};
    throw new Error(`Unexpected option catalog dependency: ${name}`);
  } }, { filename, timeout: 5000 });
  return module.exports.bathroomSteps.flatMap((step, index) => step.groups.flatMap(group =>
    group.choices.map(option => ({ ...option, key: `${group.key}:${option.id}`,
      group: group.title, groupKey: group.key, step: index + 1 }))));
}

const ids = value => Array.isArray(value) ? value : [value];
function aliasCandidates(map, normalized) {
  return Object.entries(map ?? {}).filter(([name]) => normalizeFilename(name) === normalized)
    .flatMap(([, target]) => ids(target));
}

export function matchFilename(filename, options, aliases) {
  const normalized = normalizeFilename(filename);
  // Keywords use a complete normalized phrase, never substring guessing.
  const stages = [
    () => aliasCandidates(aliases.exact, normalized),
    () => options.filter(o => normalizeFilename(o.name) === normalized).map(o => o.key),
    () => aliasCandidates(aliases.keywords, normalized),
    () => aliasCandidates(aliases.synonyms, normalized),
  ];
  for (const stage of stages) {
    const candidates = [...new Set(stage())];
    if (!candidates.length) continue;
    if (candidates.length > 1) return { status: 'AMBIGUOUS', candidates,
      candidateLabels: candidates.map(key => { const o = options.find(o => o.key === key); return o ? `STEP ${o.step} / ${o.group} / ${o.name} (${key})` : key; }) };
    const option = options.find(o => o.key === candidates[0]);
    if (!option) return { status: 'OPTION_NOT_FOUND', candidates };
    if (!option.showBuilderImage || !option.builderImage) return { status: 'SKIPPED_NO_IMAGE', option };
    return { status: 'MATCHED', option };
  }
  return { status: 'UNMATCHED' };
}

function correctFormat(bytes, extension) {
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function targetPath(root, url) {
  if (!url.startsWith(prefix) || url.includes('..') || url.includes('\\')) throw new Error(`Unsafe image path: ${url}`);
  const target = path.resolve(root, 'public', '.' + url);
  const base = path.resolve(root, 'public/images/bathroom-builder') + path.sep;
  if (!target.startsWith(base)) throw new Error(`Image target escaped builder directory: ${url}`);
  return target;
}

async function readOptional(file) {
  try { return await fs.readFile(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function syncImages({ root = projectRoot, options, aliases } = {}) {
  options ??= await loadOptions(root);
  aliases ??= JSON.parse(await fs.readFile(path.join(root, 'data/bathroom-builder-image-aliases.json'), 'utf8'));
  const inbox = path.join(root, 'public/images/bathroom-builder/inbox');
  await fs.mkdir(inbox, { recursive: true });
  const manifestPath = path.join(root, 'data/bathroom-builder-images.generated.json');
  const previous = await readOptional(manifestPath);
  const manifest = previous ? JSON.parse(previous) : {};
  const entries = (await fs.readdir(inbox, { withFileTypes: true }))
    .filter(e => e.isFile() && extensions.has(path.extname(e.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const results = [];
  for (const entry of entries) {
    const result = { file: entry.name, ...matchFilename(entry.name, options, aliases) };
    if (result.status === 'MATCHED') {
      result.bytes = await fs.readFile(path.join(inbox, entry.name));
      const extension = path.extname(entry.name).toLowerCase();
      if (!correctFormat(result.bytes, extension)) result.status = 'INVALID_FORMAT';
      else result.url = result.option.builderImage.replace(/\.[^.\/]+$/, extension);
    }
    results.push(result);
  }
  // Resolve the complete batch before writing: even identical duplicates require
  // the user to leave one file in inbox. Never pick by filename or modified date.
  const targets = new Map();
  for (const result of results.filter(r => r.option && ['MATCHED', 'INVALID_FORMAT'].includes(r.status))) {
    const list = targets.get(result.option.key) ?? [];
    list.push(result); targets.set(result.option.key, list);
  }
  for (const batch of targets.values()) {
    if (batch.length > 1) {
      const identical = batch.every(r => digest(r.bytes) === digest(batch[0].bytes));
      for (const result of batch) { result.status = 'DUPLICATE_TARGET'; result.identical = identical; }
    }
  }
  for (const result of results.filter(r => r.status === 'MATCHED')) {
    const target = targetPath(root, result.url);
    const old = await readOptional(target);
    if (old && !old.equals(result.bytes)) {
      const archive = path.join(root, 'public/images/bathroom-builder/archive',
        result.url.slice(prefix.length).replace(/\.[^.]+$/, '') + '-' + digest(old) + path.extname(target));
      await fs.mkdir(path.dirname(archive), { recursive: true });
      await fs.writeFile(archive, old);
      result.archived = path.relative(root, archive).replaceAll('\\', '/');
    }
    if (!old || !old.equals(result.bytes)) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(inbox, result.file), target);
      result.action = old ? 'REPLACED' : 'COPIED';
    } else result.action = 'UNCHANGED';
    manifest[result.option.key] = result.url;
  }
  const output = JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n';
  if (previous?.toString() !== output) {
    const temporary = manifestPath + '.tmp';
    await fs.writeFile(temporary, output);
    await fs.rename(temporary, manifestPath);
  }
  return results.map(({ bytes, ...result }) => result);
}

export function printReport(results) {
  for (const status of ['MATCHED', 'UNMATCHED', 'AMBIGUOUS', 'DUPLICATE_TARGET', 'OPTION_NOT_FOUND', 'SKIPPED_NO_IMAGE', 'INVALID_FORMAT']) {
    const rows = results.filter(r => r.status === status);
    console.log(`\n${status}: ${rows.length}`);
    for (const row of rows) {
      console.log(`  ${row.file}`);
      if (row.option) console.log(`    → STEP ${String(row.option.step).padStart(2, '0')} / ${row.option.group} / ${row.option.name}`);
      if (row.url && status === 'MATCHED') console.log(`    → ${row.url} (${row.action})`);
      if (row.archived) console.log(`    이전 파일 보관: ${row.archived}`);
      if (row.candidates) console.log(`    후보: ${(row.candidateLabels ?? row.candidates).join(' / ')} — 카테고리를 포함한 이름으로 변경하세요.`);
      if (status === 'UNMATCHED') console.log('    일치하는 Builder option 없음. 선택지 이름을 확인하세요.');
      if (status === 'DUPLICATE_TARGET') console.log(`    ${row.identical ? '내용 동일. ' : ''}사용할 파일 하나만 inbox에 남기세요. 기존 연결은 유지됩니다.`);
      if (status === 'SKIPPED_NO_IMAGE') console.log('    사진 없는 기존 옵션입니다. 표시 규칙을 유지합니다.');
      if (status === 'INVALID_FORMAT') console.log('    실제 파일 형식과 확장자가 일치하지 않습니다.');
    }
  }
  console.log(`\n읽은 이미지: ${results.length}. 원본 삭제·리사이즈·재인코딩 없음.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncImages().then(printReport).catch(error => { console.error(error); process.exitCode = 1; });
}
