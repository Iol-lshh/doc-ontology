'use strict';

// GuiCommandController (ADR 0011·0013).
// GUI 진입점이자 어댑터: HTTP 서버 + 정적 제공 + 명령 엔드포인트 + 하트비트/자동종료.
// 명령 로직은 갖지 않는다 — Facade로 위임한다(아직 stub).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { load } = require('./config.js');
const buildFacade = require('./facade/build-facade.js');
const rollbackFacade = require('./facade/rollback-facade.js');
const findFilePathFacade = require('./facade/find-file-path-facade.js');
const findGraphFacade = require('./facade/find-graph-facade.js');
const findDocumentFacade = require('./facade/find-document-facade.js');
const findHistoryFacade = require('./facade/find-history-facade.js');

const TEMPLATE_DIR = path.join(__dirname, '..', 'template');
const GUI_HTML = path.join(TEMPLATE_DIR, 'gui.html');
const STATICS_DIR = path.join(TEMPLATE_DIR, 'statics');

const MIME = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8' };

// /statics/* 정적 파일 제공. statics 디렉터리 밖으로 나가는 경로(.. 등)는 막는다.
function serveStatic(res, urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/statics\//, ''));
  const file = path.join(STATICS_DIR, rel);
  if (!file.startsWith(STATICS_DIR + path.sep)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

// 하트비트 타임아웃은 config(gui.heartbeatTimeoutSec)에서 읽는다(ADR 0009).

// 떠 있는 서버가 우리 것인지 가리는 표식 (다른 앱이 같은 포트를 쓸 때 오인 방지).
const HEALTH_MARKER = 'ontology-gui';

function openBrowser(url) {
  // 현재 darwin 기준. 크로스플랫폼 확장은 후순위(IMPLEMENTATION-PLAN 미결).
  execFile('open', [url], (err) => {
    if (err) console.error(`브라우저 열기 실패: ${url}\n수동으로 여세요.`);
  });
}

// 이미 떠 있는 우리 서버인지 health로 확인. 응답 형식까지 봐서 남의 앱과 구분.
function checkExisting(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 800 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(res.statusCode === 200 && body.includes(HEALTH_MARKER)));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startServer(port, heartbeatTimeoutMs) {
  let lastBeat = Date.now();

  const json = (res, code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };

  const server = http.createServer((req, res) => {
    const { method } = req;
    const parsed = new URL(req.url, 'http://127.0.0.1');
    const url = parsed.pathname;

    // 정적 자산 — front 컴포넌트(js/css). 읽기 전용.
    if (method === 'GET' && url.startsWith('/statics/')) return serveStatic(res, url);

    // 조회 엔드포인트 — find류 Facade로 위임(ADR 0013). 읽기 전용.
    if (method === 'GET' && url === '/find/file-path') return json(res, 200, findFilePathFacade.tree());
    if (method === 'GET' && url === '/find/graph') return json(res, 200, findGraphFacade.graph());
    if (method === 'GET' && url === '/find/history') return json(res, 200, findHistoryFacade.history());
    if (method === 'GET' && url === '/find/document') {
      const result = findDocumentFacade.document(parsed.searchParams.get('id'));
      return json(res, result.ok ? 200 : 404, result);
    }

    if (method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, marker: HEALTH_MARKER }));
      return;
    }

    if (method === 'POST' && url === '/heartbeat') {
      lastBeat = Date.now();
      res.writeHead(204);
      res.end();
      return;
    }

    // 명령 엔드포인트 — Facade로 위임(ADR 0013). Controller는 호출·표시만.
    if (method === 'POST' && url === '/build-ontology') {
      const result = buildFacade.build();
      res.writeHead(result.ok ? 200 : 422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // rollback — generation 쿼리 있으면 히스토리 롤백, 없으면 빌드 롤백(ADR 0010).
    if (method === 'POST' && url === '/rollback') {
      const generation = parsed.searchParams.get('generation');
      const result = generation ? rollbackFacade.historyRollback(generation) : rollbackFacade.buildRollback();
      return json(res, result.ok ? 200 : 422, result);
    }

    if (method === 'GET' && (url === '/' || url === '/index.html')) {
      fs.readFile(GUI_HTML, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('gui.html 없음 — 빌드(build-ontology)로 템플릿을 렌더해야 합니다.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  // 하트비트 감시: 타임아웃 넘게 ping이 없으면 self-exit (좀비 방지).
  const watcher = setInterval(() => {
    if (Date.now() - lastBeat > heartbeatTimeoutMs) {
      console.log('하트비트 끊김 — 서버 종료');
      clearInterval(watcher);
      server.close(() => process.exit(0));
    }
  }, 2_000);

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`GUI 서버 기동: ${url}`);
    openBrowser(url);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`포트 ${port} 사용 중 — 우리 서버가 아닙니다. config.yml의 gui.port를 바꾸세요.`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

async function main() {
  const cfg = load();
  const port = cfg.gui.port;
  const url = `http://127.0.0.1:${port}`;

  if (await checkExisting(port)) {
    console.log(`GUI 서버 이미 떠 있음 — 브라우저만 엽니다: ${url}`);
    openBrowser(url);
    return;
  }
  startServer(port, cfg.gui.heartbeatTimeoutSec * 1000);
}

main();
