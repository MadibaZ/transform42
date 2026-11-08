// Tiny test server: serves a directory, logs every request, and can be switched between "releases".
const http=require('http'),fs=require('fs'),path=require('path');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2','.css':'text/css','.json':'application/json','.txt':'text/plain'};
function start(port,state){
  const srv=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://x');state.log.push({m:req.method,p:u.pathname+u.search});
    let p=decodeURIComponent(u.pathname);if(p.endsWith('/'))p+='index.html';
    const f=path.join(state.root,p);
    const extra=(state.headers||{})[p]||{};
    if(!f.startsWith(state.root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404,{'Content-Type':'text/plain'});res.end('not found');return}
    const h=Object.assign({'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Access-Control-Allow-Origin':'*'},p==='/sw.js'?{'Cache-Control':'no-cache'}:{},extra);
    res.writeHead(200,h);fs.createReadStream(f).pipe(res);
  });
  return new Promise(r=>srv.listen(port,'127.0.0.1',()=>r(srv)));
}
const stop=srv=>new Promise(r=>{srv.closeAllConnections&&srv.closeAllConnections();srv.close(()=>r())});
module.exports={start,stop};
