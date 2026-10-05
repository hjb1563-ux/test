import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { syncImages } from './sync-builder-images.mjs';

// Explicit import operation; ordinary dev/build syncs never move uploads.
export async function importTileSurfaces(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const base = path.join(root, 'public/images/bathroom-builder');
  const scan = await syncImages({root});
  const inbox = scan.files.filter(row => row.file.startsWith('inbox/'));
  const report = {inbox:'public/images/bathroom-builder/inbox', scanned:inbox.length, moved:[], retained:[]};
  for (const row of inbox) {
    if (!row.surface || row.status !== 'MATCHED') {
      report.retained.push({file:row.file,status:row.status,reason:'Not a unique current size + mood + surface combination'});
      continue;
    }
    const destination = `tile/finish/${row.size}/${path.basename(row.file)}`;
    const sourcePath = path.resolve(base, row.file), targetPath = path.resolve(base, destination);
    if (![sourcePath,targetPath].every(filename => filename.startsWith(base + path.sep))) throw new Error('Import path outside Builder root');
    try {
      await fs.access(targetPath);
      report.retained.push({file:row.file,status:'COLLISION',reason:'Destination exists; source retained'});
      continue;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.mkdir(path.dirname(targetPath),{recursive:true});
    await fs.rename(sourcePath,targetPath);
    const bytes = await fs.readFile(targetPath);
    if (createHash('sha256').update(bytes).digest('hex') !== row.hash) throw new Error('Original hash changed: ' + destination);
    report.moved.push({from:row.file,to:destination,size:row.size,mood:row.mood,surface:row.surface,version:row.version,bytes:bytes.length,hash:row.hash});
  }
  // Keep the original import evidence on repeated runs with no new uploads.
  if (report.moved.length) await fs.writeFile(path.join(root,'docs/BUILDER_TILE_SURFACE_IMPORT.json'),JSON.stringify(report,null,2)+'\n');
  await syncImages({root});
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importTileSurfaces().then(report=>console.log(`INBOX: ${report.scanned}; MOVED: ${report.moved.length}; RETAINED: ${report.retained.length}`))
    .catch(error=>{console.error(error);process.exitCode=1;});
}
