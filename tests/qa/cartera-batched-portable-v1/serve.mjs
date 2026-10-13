import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./web/',import.meta.url)),port=8787;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' data:; font-src 'self' data:; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 try{const requestPath=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);const relative=requestPath==='/'?'index.html':requestPath.replace(/^\/+/, '');const full=path.resolve(root,relative);if(!full.startsWith(root)||relative.includes('\\')){res.writeHead(403);res.end();return;}const stat=await fs.stat(full);if(!stat.isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(full)]??'application/octet-stream');res.setHeader('Content-Length',stat.size);res.writeHead(200);res.end(req.method==='HEAD'?undefined:await fs.readFile(full));}catch{res.writeHead(404);res.end();}
});
server.on('error',error=>{console.error('No se inició el servidor local:',error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`QA local: http://127.0.0.1:${port}\nSólo sirve ./web en este equipo. Ctrl+C para detener. No abre el navegador automáticamente.`));
