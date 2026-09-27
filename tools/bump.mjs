// Bump the app version in both places that must match:
//   app/version.js  APP_VERSION = 'x.y'
//   sw.js           CACHE_VERSION = 'coach-v-x.y'
// Usage: node tools/bump.mjs          -> next minor (1.1 -> 1.2)
//        node tools/bump.mjs 2.0      -> set explicitly
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vPath = join(root, 'app/version.js'), swPath = join(root, 'sw.js');
const vSrc = readFileSync(vPath, 'utf8'), swSrc = readFileSync(swPath, 'utf8');
const cur = vSrc.match(/APP_VERSION = '([^']+)'/)[1];
const swCur = swSrc.match(/CACHE_VERSION = 'coach-v-([^']+)'/)[1];
if (cur !== swCur) { console.error(`Versions out of sync: version.js ${cur}, sw.js ${swCur}. Fix by hand first.`); process.exit(1); }

let next = process.argv[2];
if (!next) { const [maj, min] = cur.split('.').map(Number); next = `${maj}.${min + 1}`; }
if (!/^\d+\.\d+$/.test(next)) { console.error(`Version must look like x.y, got "${next}"`); process.exit(1); }

writeFileSync(vPath, vSrc.replace(/APP_VERSION = '[^']+'/, `APP_VERSION = '${next}'`));
writeFileSync(swPath, swSrc.replace(/CACHE_VERSION = 'coach-v-[^']+'/, `CACHE_VERSION = 'coach-v-${next}'`));
console.log(`${cur} -> ${next}  (app/version.js and sw.js)`);
