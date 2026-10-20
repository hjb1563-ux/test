import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function verifyInventory(images, { tracked, referenced, readFile = fs.readFile }) {
  let verified = 0, absentArchives = 0;
  for (const image of images) {
    const filename = image.destination.replaceAll('\\', '/');
    // Historical unselected imports are an archive, not deployable dependencies.
    // A tracked, assigned or runtime-referenced file can never take this path.
    const archive = filename.startsWith('public/images/bathroom-builder/inbox/')
      && image.decision === 'retain: unmatched, older version or unselected original'
      && image.assignments.length === 0 && image.references.length === 0
      && !tracked.has(filename) && !referenced.has(filename);
    let bytes;
    try { bytes = await readFile(filename); }
    catch (error) {
      if (archive && error.code === 'ENOENT') { absentArchives++; continue; }
      throw error;
    }
    // Git may check text SVGs out as CRLF on Windows; compare canonical LF text.
    // Binary images always retain the exact original byte comparison.
    const hash = data => createHash('sha256').update(data).digest('hex');
    const actual = hash(bytes);
    const canonical = filename.endsWith('.svg') ? hash(bytes.toString('utf8').replaceAll('\r\n', '\n')) : actual;
    assert.ok(actual === image.hash || canonical === image.hash, 'Original bytes: ' + filename);
    verified++;
  }
  return { verified, absentArchives };
}
