import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('static output contains no upstream configuration or credentials and all asset references exist',async()=>{
  const html=await readFile(new URL('dist/index.html',root),'utf8');assert.ok(html.includes('GaleriKita'));assert.ok(!/supabase\.co|eyJhbGci/.test(html));
  const files=await readdir(new URL('dist/assets/',root));
  for(const file of files){const body=await readFile(new URL(`dist/assets/${file}`,root),'utf8');assert.ok(!/eyJhbGci|supabase\.co|ANON_KEY|service_role/.test(body),file);}
  for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g))await readFile(new URL(`dist${match[1]}`,root));
  assert.ok(files.every(file=>/\.[a-f0-9]{12}\.(js|css)$/.test(file)));
});
