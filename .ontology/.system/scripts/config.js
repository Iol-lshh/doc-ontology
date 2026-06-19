'use strict';

// config.yml 로더 (ADR 0009). 외부 의존 없이 동작해야 하므로
// 이 프로젝트의 단순한 yml(들여쓰기 중첩, 스칼라 값, 주석/빈 줄)만 파싱한다.
// 복잡한 yaml 문법(리스트, 멀티라인, 앵커)은 지원하지 않는다 — config가 그 수준을 넘으면 그때 파서를 바꾼다.

const fs = require('node:fs');
const path = require('node:path');

// .ontology 루트 = 이 파일(.system/scripts/config.js) 기준 두 단계 위.
const ONTOLOGY_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ONTOLOGY_ROOT, 'config.yml');

// 사람 입력 디렉터리는 .ontology/database 고정(ADR 0003). config 대상은 산출물 위치뿐.
const DEFAULTS = {
  system: { database: { path: './.system/database/' } },
  history: { enabled: true },
  gui: { port: 7777, heartbeatTimeoutSec: 10 },
};

function scalar(raw) {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v.replace(/^["']|["']$/g, '');
}

// 들여쓰기 깊이로 중첩을 만든다(2칸=1단계). 스택으로 부모를 추적한다.
function parse(text) {
  const root = {};
  const stack = [{ indent: -1, node: root }];
  for (const line of text.split('\n')) {
    const noComment = line.replace(/\s+#.*$/, '').replace(/^#.*$/, '');
    if (noComment.trim() === '') continue;
    const indent = noComment.match(/^\s*/)[0].length;
    const idx = noComment.indexOf(':');
    if (idx === -1) continue;
    const key = noComment.slice(0, idx).trim();
    const value = noComment.slice(idx + 1).trim();

    // 현재 들여쓰기보다 깊거나 같은 부모는 스택에서 제거 → 알맞은 부모를 찾는다.
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;

    if (value === '') {
      const child = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      parent[key] = scalar(value);
    }
  }
  return root;
}

function deepMerge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(base[k] || {}, v) : v;
  }
  return out;
}

function load() {
  let parsed = {};
  if (fs.existsSync(CONFIG_PATH)) {
    parsed = parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  const cfg = deepMerge(DEFAULTS, parsed);
  cfg.ontologyRoot = ONTOLOGY_ROOT;
  // 사람 입력은 고정. 산출물(.system/database)은 config로 옮길 수 있다.
  cfg.databaseDir = path.join(ONTOLOGY_ROOT, 'database');
  // system.database.path는 config.yml 위치(.ontology) 기준 resolve.
  // 상대경로(../포함)는 그 기준으로 풀고, 절대경로는 그대로 쓴다.
  cfg.systemDbDir = path.resolve(ONTOLOGY_ROOT, cfg.system.database.path);
  return cfg;
}

module.exports = { load, ONTOLOGY_ROOT, CONFIG_PATH };
