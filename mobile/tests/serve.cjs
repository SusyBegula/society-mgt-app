const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const root='/tmp/neighbourly-web';
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.css':'text/css','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!target.startsWith(root+'/')&&target!==root){res.writeHead(403);res.end();return;}
  const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
}).listen(8020,'127.0.0.1');
