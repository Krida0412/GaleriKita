import test from 'node:test';
import assert from 'node:assert/strict';
import { createPropertiesHandler } from '../lib/properties-service.js';
const env={SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_ANON_KEY:'test-key-only-not-a-real-secret'};
const row={id:'test-id',title:'Rumah Uji',type:'Rumah Baru',status:'active',price:'Rp 500 Juta',image:'https://res.cloudinary.com/test/image/upload/v1/house.jpg',details:{beds:3,area:'120 m²',internal_key:'do-not-return'},images:['javascript:alert(1)','https://example.com/room.jpg'],internal_secret:'do-not-return'};
const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
async function invoke(handler,{method='GET',url='/api/properties'}={}){const res={headers:{},statusCode:200,body:'',setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(body){this.body=body||'';}};await handler({method,url},res);return res;}
test('only fixed read-only query is sent, credentials remain in server request headers',async()=>{
  let upstream;
  const handler=createPropertiesHandler({env,fetchImpl:async(url,options)=>{upstream={url:new URL(url),options};return response([row]);}});
  const out=await invoke(handler);assert.equal(out.statusCode,200);
  assert.equal(upstream.url.pathname,'/rest/v1/properties');assert.equal(upstream.url.searchParams.get('status'),'eq.active');assert.equal(upstream.url.searchParams.get('limit'),'500');
  assert.equal(upstream.options.method,'GET');assert.equal(upstream.options.redirect,'error');assert.equal(upstream.options.headers.apikey,env.SUPABASE_ANON_KEY);assert.equal(upstream.options.headers.Authorization,`Bearer ${env.SUPABASE_ANON_KEY}`);
  const [item]=JSON.parse(out.body);assert.equal(item.details.beds,3);assert.equal(item.internal_secret,undefined);assert.equal(item.details.internal_key,undefined);assert.deepEqual(item.images,['https://example.com/room.jpg']);
  assert.ok(!out.body.includes(env.SUPABASE_ANON_KEY));assert.ok(!out.body.includes(env.SUPABASE_URL));assert.equal(out.headers['access-control-allow-origin'],undefined);
});
test('rejects writes and arbitrary filters or target URLs without contacting upstream',async()=>{
  let calls=0;const handler=createPropertiesHandler({env,fetchImpl:async()=>{calls++;return response([]);}});
  for(const method of ['POST','PUT','DELETE','PATCH','OPTIONS']){const out=await invoke(handler,{method});assert.equal(out.statusCode,405);assert.equal(out.headers.allow,'GET, HEAD');}
  for(const url of ['/api/properties?select=*','/api/properties?url=https://evil.test','/api/properties?offset=-1'])assert.equal((await invoke(handler,{url})).statusCode,400);
  assert.equal(calls,0);
});
test('fails closed with missing configuration or a non-Supabase upstream',async()=>{
  for(const invalid of [{},{...env,SUPABASE_URL:'http://test-project.supabase.co'},{...env,SUPABASE_URL:'https://supabase.co.evil.test'}]){
    const handler=createPropertiesHandler({env:invalid,fetchImpl:()=>{throw new Error('should not fetch');}});const out=await invoke(handler);assert.equal(out.statusCode,503);assert.equal(out.headers['cache-control'],'no-store');
  }
});
test('returns safe errors without upstream response details or configuration',async()=>{
  const handler=createPropertiesHandler({env,fetchImpl:async()=>new Response(`error ${env.SUPABASE_ANON_KEY}`,{status:401})});const out=await invoke(handler);assert.equal(out.statusCode,502);assert.ok(!out.body.includes('test-key'));assert.equal(out.headers['cache-control'],'no-store');
});
test('coalesces concurrent loads and serves cached data',async()=>{
  let calls=0;let release;const ready=new Promise(r=>release=r);
  const handler=createPropertiesHandler({env,fetchImpl:async()=>{calls++;await ready;return response([row]);}});
  const a=invoke(handler),b=invoke(handler);release();const results=await Promise.all([a,b]);assert.equal(calls,1);assert.equal(results[0].body,results[1].body);await invoke(handler);assert.equal(calls,1);
});
test('uses bounded stale cache on outage, expires it, then retries normally',async()=>{
  let time=0,offline=false;
  const handler=createPropertiesHandler({env,now:()=>time,fetchImpl:async()=>{if(offline)throw new Error('offline');return response([row]);}});
  await invoke(handler);offline=true;time=301_000;const stale=await invoke(handler);assert.equal(stale.statusCode,200);assert.equal(stale.headers['x-data-cache'],'stale');
  time=3_600_001;assert.equal((await invoke(handler)).statusCode,502);offline=false;assert.equal((await invoke(handler)).statusCode,200);
});
test('HEAD returns metadata without a body',async()=>{const out=await invoke(createPropertiesHandler({env,fetchImpl:async()=>response([row])}),{method:'HEAD'});assert.equal(out.statusCode,200);assert.equal(out.body,'');});
test('rejects malformed upstream data without publishing partial or inactive rows',async()=>{
  for(const payload of [{error:'bad'},Array(501).fill(row)]){assert.equal((await invoke(createPropertiesHandler({env,fetchImpl:async()=>response(payload)}))).statusCode,502);}
  const out=await invoke(createPropertiesHandler({env,fetchImpl:async()=>response([row,row,{...row,id:'inactive',status:'sold'}])}));assert.equal(JSON.parse(out.body).length,1);
});
test('paginates on the server and retains stable ordering',async()=>{
  const offsets=[];const handler=createPropertiesHandler({env,fetchImpl:async(url)=>{const offset=new URL(url).searchParams.get('offset');offsets.push(offset);return response(offset==='0'?Array.from({length:500},(_,i)=>({...row,id:String(i)})):[{...row,id:'last'}]);}});
  const out=await invoke(handler);assert.deepEqual(offsets,['0','500']);assert.equal(JSON.parse(out.body).length,501);
});
