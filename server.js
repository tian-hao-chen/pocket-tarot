import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/interpret.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 讀取 .env 中的 GEMINI_API_KEY
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const server = http.createServer((req, res) => {
  // 處理 API 請求
  if (req.url === '/api/interpret' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
      } catch (e) {
        req.body = {};
      }
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };
      handler(req, res);
    });
    return;
  }

  // 處理前端靜態網頁 (public/index.html)
  const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n✨ 口袋塔羅本機伺服器已啟動！`);
  console.log(`👉 請打開瀏覽器輸入: http://localhost:${PORT}\n`);
});