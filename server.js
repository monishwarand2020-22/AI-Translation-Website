const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = parsedUrl.pathname;

  // Real Translation API Endpoint
  if (reqPath === '/api/translate') {
    try {
      let text = parsedUrl.searchParams.get('text');
      let source = parsedUrl.searchParams.get('source') || 'en';
      let target = parsedUrl.searchParams.get('target') || 'ta';

      if (!text && req.method === 'POST') {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const bodyStr = Buffer.concat(buffers).toString();
        try {
          const body = JSON.parse(bodyStr);
          text = body.text;
          if (body.source) source = body.source;
          if (body.target) target = body.target;
        } catch (e) {}
      }

      if (!text || !text.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Text parameter is required' }));
        return;
      }

      // Convert full locale codes (e.g. 'en-IN', 'ta-IN') to base codes ('en', 'ta')
      const sl = source.split('-')[0].toLowerCase();
      const tl = target.split('-')[0].toLowerCase();

      let translatedText = '';
      const startTime = Date.now();

      // Strategy 1: Google Translate public endpoint
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text.trim())}`;
        const gRes = await fetch(gUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (gRes.ok) {
          const gData = await gRes.json();
          if (Array.isArray(gData) && Array.isArray(gData[0])) {
            translatedText = gData[0].map(item => item[0]).join('');
          }
        }
      } catch (gErr) {
        console.warn('Google translate attempt failed:', gErr.message);
      }

      // Strategy 2: MyMemory fallback if Google was empty
      if (!translatedText) {
        try {
          const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${sl}|${tl}`;
          const mmRes = await fetch(mmUrl);
          if (mmRes.ok) {
            const mmData = await mmRes.json();
            if (mmData && mmData.responseData && mmData.responseData.translatedText) {
              translatedText = mmData.responseData.translatedText;
            }
          }
        } catch (mmErr) {
          console.warn('MyMemory fallback failed:', mmErr.message);
        }
      }

      if (!translatedText) {
        throw new Error('Unable to translate text via available translation services');
      }

      const latencyMs = Date.now() - startTime;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        originalText: text,
        translatedText: translatedText,
        source: sl,
        target: tl,
        latencyMs: latencyMs
      }));
      return;
    } catch (err) {
      console.error('Translation error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Translation failed' }));
      return;
    }
  }

  // Static File Serving
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n🚀 AI Voice Translator is running!`);
    console.log(`📡 Local URL: http://localhost:${port}`);
    console.log(`Press Ctrl+C to stop.\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port busy, trying next port...`);
    startServer(server.address() ? server.address().port + 1 : DEFAULT_PORT + 1);
  } else {
    console.error('Server error:', err);
  }
});

startServer(DEFAULT_PORT);
