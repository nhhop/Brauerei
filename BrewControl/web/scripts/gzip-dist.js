import { gzipSync } from 'zlib';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function gzipDir(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) gzipDir(p);
    else if (!entry.endsWith('.gz')) writeFileSync(p + '.gz', gzipSync(readFileSync(p), { level: 9 }));
  }
}

gzipDir('dist');
console.log('gzip done');
