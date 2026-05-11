/**
 * Ensures `public/` exists after `tsc` so Vercel builds that expect a `public`
 * folder still find one. Do not set `vercel.json#outputDirectory` to `public`:
 * that turns the project into a static-only export and Hono routes return 404.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(serverRoot, 'public');

fs.mkdirSync(pub, { recursive: true });
const marker = path.join(pub, '.vercel-build');
fs.writeFileSync(marker, `build ${new Date().toISOString()}\n`, 'utf8');

const robotsPath = path.join(pub, 'robots.txt');
if (!fs.existsSync(robotsPath)) {
  fs.writeFileSync(
    robotsPath,
    '# See README — static extras only; API is Hono (src/index.ts).\nUser-agent: *\nDisallow: /\n',
    'utf8',
  );
}
