import { execFileSync } from 'child_process';
import { rmSync, cpSync, statSync } from 'fs';
import { join } from 'path';

// Packs the gzipped dist/ (pnpm build:sd) into the two UI tars the release
// ships — see BrewControl/README.md:
//   webui.tar       without dist/modules, for the boards with the 256 KB partition
//   webui-full.tar  with the optional packages, for the SD boards
// Relative paths only: GNU tar reads "C:" as a host name.
const stage = 'dist-slim';

rmSync(stage, { recursive: true, force: true });
cpSync('dist', stage, { recursive: true, filter: (src) => src !== join('dist', 'modules') });
execFileSync('tar', ['-C', stage, '-cf', 'webui.tar', '.']);
execFileSync('tar', ['-C', 'dist', '-cf', 'webui-full.tar', '.']);
rmSync(stage, { recursive: true, force: true });

for (const f of ['webui.tar', 'webui-full.tar']) console.log(`${f}: ${statSync(f).size} bytes`);
