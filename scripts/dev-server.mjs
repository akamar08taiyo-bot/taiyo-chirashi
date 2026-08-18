import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.map': 'application/json; charset=utf-8'
};
const server = http.createServer(async (req, res) => {
  const requested = decodeURIComponent((req.url || '/').split('?')[0] || '/');
  let target = path.join(root, requested === '/' ? 'index.html' : requested.replace(/^\//, ''));
  if (!target.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  if (!existsSync(target)) target = path.join(root, 'index.html');
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
server.listen(port, host, () => console.log(`TSS Flyer App: http://${host}:${port}`));
