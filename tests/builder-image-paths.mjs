import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadOptions } from '../scripts/sync-builder-images.mjs';
const root = path.resolve('.');
const publicRoot = path.join(root,'public');
const options = await loadOptions(root,{includeGenerated:true});
const combinations = JSON.parse(await fs.readFile('data/bathroom-builder-tile-images.generated.json','utf8'));
const imported = JSON.parse(await fs.readFile('data/bathroom-builder-images.generated.json','utf8'));
const refs = [...options.filter(o=>o.showBuilderImage).map(o=>o.builderImage), ...Object.values(combinations).flatMap(Object.values), ...Object.values(imported), '/images/bathroom-builder/fallback/placeholder.svg'];
async function scanSources(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await scanSources(file);else if(/\.(tsx?|css)$/.test(file)){const text=await fs.readFile(file,'utf8');for(const match of text.matchAll(/['"](\/images\/[^'"\x60]+\.(?:png|jpe?g|webp|svg|avif))['"]/gi))refs.push(match[1]);}}}
for(const dir of ['app','components','data/guides'])await scanSources(dir);
for(const url of new Set(refs)){
 assert.equal(typeof url,'string');const decoded=decodeURIComponent(url);assert.ok(decoded.startsWith('/images/'));
 const filename=path.resolve(publicRoot,'.'+decoded);assert.ok(filename.startsWith(publicRoot+path.sep));
 let folder=publicRoot;for(const segment of decoded.slice(1).split('/')){assert.ok((await fs.readdir(folder)).includes(segment),'Exact case/Unicode path: '+url);folder=path.join(folder,segment);}assert.ok((await fs.stat(filename)).isFile());
}
const inventory=JSON.parse(await fs.readFile('docs/BUILDER_IMAGE_INVENTORY.json','utf8'));
for(const image of inventory.images){const current=await fs.readFile(image.destination);assert.equal(createHash('sha256').update(current).digest('hex'),image.hash,'Original bytes: '+image.destination);}
console.log('PASS: '+refs.length+' image references ('+new Set(refs).size+' unique), exact case/Unicode paths, '+inventory.images.length+' original hashes, '+inventory.moves.length+' moves, 0 missing images');
