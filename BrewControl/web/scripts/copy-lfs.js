import { rmSync, cpSync } from 'fs';
import { join } from 'path';

// Stages dist/ as firmware/data/www for `pio run -t uploadfs` (LittleFS boards,
// 256 KB partition). Leaves out dist/modules: the optional UI packages are not
// meant for these boards and a later "Installieren" with webui.tar would wipe
// them anyway — see BrewControl/README.md.
const target = join('..', 'firmware', 'data', 'www');
const skip = join('dist', 'modules');

rmSync(target, { recursive: true, force: true });
cpSync('dist', target, { recursive: true, filter: (src) => src !== skip });
console.log(`staged ${target} (without modules)`);
