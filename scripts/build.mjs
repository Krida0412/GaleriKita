import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'src');
await mkdir(path.join(root, 'dist', 'assets'), { recursive: true });
let html = await readFile(path.join(source, 'index.html'), 'utf8');
for (const name of ['app.js','utils.js','style.css','refinements.css']) {
  const data = await readFile(path.join(source, name));
  if (/supabase\.co|eyJhbGci|ANON_KEY|service_role|SUPABASE_ANON_KEY/.test(data.toString())) throw new Error(`Server configuration found in browser asset: ${name}`);
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
  const asset = `${path.parse(name).name}.${hash}${path.extname(name)}`;
  await writeFile(path.join(root, 'dist', 'assets', asset), data);
  html = html.replaceAll(`/${name}`, `/assets/${asset}`);
}
if (/supabase\.co|eyJhbGci|SUPABASE_ANON_KEY/.test(html)) throw new Error('Server configuration found in HTML');
await writeFile(path.join(root, 'dist', 'index.html'), html);
await writeFile(path.join(root, 'dist', 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /api/\n');
console.log('GaleriKita built with fingerprinted assets. Server configuration excluded.');
