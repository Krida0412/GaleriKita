import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import properties from './api/properties.js';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const config=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    for(const header of config.headers[0].headers)if(!['Strict-Transport-Security'].includes(header.key))res.setHeader(header.key,header.value.replace('; upgrade-insecure-requests',''));
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/properties')return await properties(req,res);
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
    const relative=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const target=path.resolve(root,relative);
    if(!target.startsWith(root+path.sep)&&target!==path.join(root,'index.html')){res.writeHead(403).end();return;}
    const body=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Halaman tidak ditemukan.');}
});
server.listen(Number(process.env.PORT??4174),'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
