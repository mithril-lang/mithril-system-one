import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm'};
createServer(async (req, res) => {
 try {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  const file = path === root ? resolve(root, 'index.html') : path;
  const data = await readFile(file); res.writeHead(200, {'content-type':types[extname(file)] || 'text/plain'}); res.end(data);
 } catch { res.writeHead(404); res.end(); }
}).listen(4173, '127.0.0.1');
