'use strict';

// BuildFacade (ADR 0013). build-ontology 유스케이스를 조율한다.
// scan → id → index → verify → (통과 시에만) 기록. Service를 순서·정책대로 엮을 뿐
// 스캔·판정·검증 로직 자체는 갖지 않는다(각 Service에 있다).
// 검증 통과 시에만 .system 을 갱신한다(ADR 0008) — 깨진 상태는 남기지 않는다.

const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../config.js');
const scanService = require('../service/scan-service.js');
const idService = require('../service/id-service.js');
const indexService = require('../service/index-service.js');
const verifyService = require('../service/verify-service.js');
const snapshotService = require('../service/snapshot-service.js');

const TYPE_DIR = { Concept: 'concept', Class: 'class', Instance: 'instance' };

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

// 새로 발급된 id를 database/ 원본 .md의 frontmatter에 되쓴다(ADR 0006 예외).
// 기존 frontmatter는 보존하고 id 줄만 추가한다. Class는 폴더라 대상이 아니다(.md 노드만).
function writebackId(dbDir, node) {
  const file = path.join(dbDir, node.relPath);
  const text = fs.readFileSync(file, 'utf8');
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    // 기존 frontmatter 맨 앞에 id 줄을 넣는다(id 줄이 이미 없을 때만 — freshId 노드이므로 없다).
    const updated = `---\nid: ${node.id}\n${fm[1]}\n---\n`;
    fs.writeFileSync(file, updated + text.slice(fm[0].length));
  } else {
    // frontmatter가 없으면 새로 만든다.
    fs.writeFileSync(file, `---\nid: ${node.id}\n---\n${text}`);
  }
}

// 정규화 노드 1벌 — 빌드가 채운 frontmatter(id·type·label·관계 id)를 .system에 박는다(ADR 0008).
function normalizedFrontmatter(node, indexes) {
  const lines = ['---', `id: ${node.id}`, `type: ${node.type}`, `label: ${JSON.stringify(node.label)}`];
  const out = indexes.graphIndex.edges.filter((e) => e.from === node.id);
  if (out.length) {
    lines.push('edges:');
    for (const e of out) lines.push(`  - { rel: ${e.rel}, to: ${e.to} }`);
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

function build() {
  const cfg = load();
  const dbDir = cfg.databaseDir; // 사람 입력(고정)
  const systemDb = cfg.systemDbDir; // 빌드 산출물(config로 조정 가능)

  // ── 조율 사슬 ──
  const scanned = scanService.scan(dbDir);
  const nodes = idService.assignIds(scanned);
  const indexes = indexService.build(nodes);
  const result = verifyService.verify(nodes, indexes);

  if (!result.ok) {
    // 검증 실패 — .system 갱신하지 않음(ADR 0008). 깨진 상태 안 남김.
    return { ok: false, errors: result.errors, nodeCount: nodes.length };
  }

  // 새로 발급된 id를 원본 .md에 되쓴다(ADR 0006 예외) — 재빌드 시 재사용해 id 안정.
  // Class는 폴더라 frontmatter가 없어 대상이 아니다(Concept/Instance만, 즉 .md 노드).
  const writtenBack = nodes.filter((n) => n.freshId && n.type !== 'Class');
  for (const node of writtenBack) writebackId(dbDir, node);

  // ── 통과 시에만 기록 ──
  // 덮어쓰기 직전, 기존 콘텐츠를 backup(1세대)으로 보관한다 — 빌드 롤백 대상(ADR 0010).
  // 첫 빌드(기존 콘텐츠 없음)면 backup은 빈 채로 만들어지며, 그 경우 빌드 롤백은 빈 상태로 복구된다.
  fs.mkdirSync(systemDb, { recursive: true });
  snapshotService.captureBackup(systemDb);

  const indexDir = path.join(systemDb, 'index');
  fs.mkdirSync(indexDir, { recursive: true });
  writeJson(path.join(indexDir, 'fileIndex.json'), indexes.fileIndex);
  writeJson(path.join(indexDir, 'graphIndex.json'), indexes.graphIndex);
  writeJson(path.join(indexDir, 'labelIndex.json'), indexes.labelIndex);

  // 정규화 노드 1벌 — 기존 것을 지우고 다시 쓴다(여벌이므로 재생성 가능).
  for (const dir of Object.values(TYPE_DIR)) {
    fs.rmSync(path.join(systemDb, dir), { recursive: true, force: true });
    fs.mkdirSync(path.join(systemDb, dir), { recursive: true });
  }
  for (const node of nodes) {
    const dir = path.join(systemDb, TYPE_DIR[node.type]);
    const body = node.body ? `\n${node.body}\n` : '';
    fs.writeFileSync(path.join(dir, `${node.id}.md`), normalizedFrontmatter(node, indexes) + body);
  }

  // 스냅샷 적재 — git 객체 모델로 세대(commit)를 만든다(ADR 0014). 직전과 그래프가 같으면 새 세대 안 생김.
  // history.enabled off면 건너뛴다. 빌드 롤백(여벌)은 이와 무관하게 항상 가능(ADR 0008).
  let generation = null;
  let unchanged = false;
  if (cfg.history.enabled) {
    const now = new Date();
    const tsSec = Math.floor(now.getTime() / 1000);
    const off = -now.getTimezoneOffset(); // 분, 동쪽이 +
    const tz = `${off >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}${String(Math.abs(off) % 60).padStart(2, '0')}`;
    const result = snapshotService.capture(systemDb, tsSec, tz);
    generation = result.generation;
    unchanged = result.unchanged;
  }

  return {
    ok: true,
    nodeCount: nodes.length,
    edgeCount: indexes.graphIndex.edges.length,
    generation,
    unchanged,
    idsWritten: writtenBack.length,
  };
}

module.exports = { build };
