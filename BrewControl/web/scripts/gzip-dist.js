import { gzipSync } from 'zlib';
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

// Replaces every file with its .gz: the device serves .gz transparently (also
// for the SPA fallback), and the raw copies would not fit the 256 KB data
// partition of the LittleFS boards — see BrewControl/README.md.
function gzipDir(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) gzipDir(p);
    else if (!entry.endsWith('.gz')) {
      writeFileSync(p + '.gz', gzipSync(readFileSync(p), { level: 9 }));
      unlinkSync(p);
    }
  }
}

gzipDir('dist');
console.log('gzip done');
