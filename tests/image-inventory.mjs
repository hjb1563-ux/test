import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyInventory } from './helpers/image-inventory.mjs';
const filename = 'public/images/bathroom-builder/inbox/archive.png';
const bytes = Buffer.from('original fixture bytes');
const image = { destination: filename, hash: createHash('sha256').update(bytes).digest('hex'), assignments: [], references: [], decision: 'retain: unmatched, older version or unselected original' };
const missing = async () => { throw Object.assign(new Error('missing fixture'), {code:'ENOENT'}); };
const options = {tracked:new Set(), referenced:new Set(), readFile:missing};
assert.deepEqual(await verifyInventory([image], options), {verified:0, absentArchives:1});
for (const required of [
  { ...options, tracked:new Set([filename]) },
  { ...options, referenced:new Set([filename]) },
]) await assert.rejects(verifyInventory([image], required), /missing fixture/);
for (const changed of [
  {...image, assignments:['tile:white']}, {...image, references:['component']},
  {...image, destination:'public/images/bathroom-builder/tile/required.png'},
  {...image, decision:'retain: shared/homepage/guide/brand asset'},
]) await assert.rejects(verifyInventory([changed], options), /missing fixture/);
assert.deepEqual(await verifyInventory([image], {...options, readFile:async()=>bytes}), {verified:1, absentArchives:0});
await assert.rejects(verifyInventory([image], {...options, readFile:async()=>Buffer.from('corrupt')}), /Original bytes/);
await assert.rejects(verifyInventory([image], {...options, readFile:async()=>{throw Object.assign(new Error('denied'), {code:'EACCES'});}}), /denied/);
const svg={...image,destination:'public/test.svg',hash:createHash('sha256').update('<svg>\n</svg>\n').digest('hex')};
assert.deepEqual(await verifyInventory([svg], {...options, readFile:async()=>Buffer.from('<svg>\r\n</svg>\r\n')}), {verified:1, absentArchives:0});
await assert.rejects(verifyInventory([svg], {...options, readFile:async()=>Buffer.from('<svg>changed</svg>')}), /Original bytes/);
console.log('PASS inventory: required/tracked/referenced/assigned assets cannot be skipped; absent archives only; hashes, corruption, access errors and SVG line endings');
