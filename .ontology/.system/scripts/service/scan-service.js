'use strict';

// scan-service (ADR 0005). database/ 를 순회해 노드를 모은다.
// 위치로 type 판정: 루트 직속 .md=Concept, 폴더=Class, Class 안 .md=Instance, 폴더 중첩=Class 상속.
// frontmatter의 label 관계(broader/narrower/related/about)를 파싱한다(ADR 0004·0006).
// 단일 책임: 파일시스템 → 노드 목록. id 발급·해소·검증·인덱스는 다른 Service가 한다.

const fs = require('node:fs');
const path = require('node:path');

const REL_KEYS = ['broader', 'narrower', 'related', 'about'];

// 단순 frontmatter 파서 — 이 프로젝트의 노드는 'key: ["a", "b"]' 또는 'key: value'만 쓴다.
// 외부 yaml 의존 없이 동작해야 한다(config.js와 동일 원칙).
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    if (raw.startsWith('[')) {
      data[key] = raw
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      data[key] = raw.replace(/^["']|["']$/g, '');
    }
  }
  return { data, body: text.slice(m[0].length) };
}

// 첫 # 제목을 label로 쓴다. 없으면 파일/폴더명.
function labelFromBody(body, fallback) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function relations(data) {
  const rels = {};
  for (const key of REL_KEYS) {
    if (Array.isArray(data[key]) && data[key].length) rels[key] = data[key];
  }
  return rels;
}

// databaseDir 기준 재귀 스캔. classChain = 현재까지의 상위 Class 경로(상속).
function walk(databaseDir, dir, classChain, nodes) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(databaseDir, full);

    if (entry.isDirectory()) {
      // 폴더 = Class. 상위 Class가 있으면 상속(부모 Class를 가리킴).
      const parent = classChain[classChain.length - 1] || null;
      nodes.push({
        type: 'Class',
        relPath: rel,
        name: entry.name,
        label: entry.name,
        parentClass: parent ? parent.relPath : null,
        relations: {},
      });
      walk(databaseDir, full, [...classChain, { relPath: rel, label: entry.name }], nodes);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const text = fs.readFileSync(full, 'utf8');
      const { data, body } = parseFrontmatter(text);
      const base = entry.name.replace(/\.md$/, '');
      const inClass = classChain.length > 0;
      nodes.push({
        type: inClass ? 'Instance' : 'Concept',
        relPath: rel,
        name: base,
        label: labelFromBody(body, base),
        // Instance는 부모 폴더에서 class 자동 결정(ADR 0005: 위치가 진실).
        class: inClass ? classChain[classChain.length - 1].relPath : null,
        relations: relations(data),
        // 원본 frontmatter에 박힌 id가 있으면 싣는다(재사용해 안정 유지, ADR 0002·0006).
        existingId: data.id ? String(data.id) : null,
        body: body.trim(),
      });
    }
  }
}

function scan(databaseDir) {
  if (!fs.existsSync(databaseDir)) return [];
  const nodes = [];
  walk(databaseDir, databaseDir, [], nodes);
  return nodes;
}

module.exports = { scan, parseFrontmatter };
