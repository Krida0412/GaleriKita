import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const root=new URL('../',import.meta.url);
test('serves built scripts/styles with security headers, keeps env private and routes API correctly',async()=>{
  const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'0',SUPABASE_URL:'',SUPABASE_ANON_KEY:''},stdio:['ignore','pipe','pipe']});
  try {
    const base=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);server.once('error',error=>{clearTimeout(timer);reject(error);});server.stdout.on('data',data=>{output+=data;const match=output.match(/Local: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
    const index=await fetch(base);assert.equal(index.status,200);assert.ok(index.headers.get('content-security-policy').includes("connect-src 'self'"));const html=await index.text();
    for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)){const asset=await fetch(base+match[1]);assert.equal(asset.status,200,match[1]);assert.match(asset.headers.get('content-type'),/javascript|css/);}
    assert.equal((await fetch(base+'/.env.local')).status,404);
    assert.equal((await fetch(base+'/api/properties')).status,503);
    assert.equal((await fetch(base+'/api/properties',{method:'POST'})).status,405);
  } finally {const exited=once(server,'exit');server.kill();await exited;}
});
