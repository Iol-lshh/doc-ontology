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

const CONTENT_DIRS = ['index', 'concept', 'class', 'instance'];

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

// 정규화 맵(경로→내용)을 .system에 쓴다. 콘텐츠 디렉터리를 비우고 다시 쓴다(여벌이라 재생성 가능).
function writeNormalized(systemDb, fileMap) {
  for (const dir of CONTENT_DIRS) {
    fs.rmSync(path.join(systemDb, dir), { recursive: true, force: true });
  }
  for (const [rel, content] of Object.entries(fileMap)) {
    const file = path.join(systemDb, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

// scan→id→index→verify 공통 사슬. build와 virtualBuild가 공유한다.
function runChain(dbDir) {
  const scanned = scanService.scan(dbDir);
  const nodes = idService.assignIds(scanned);
  const indexes = indexService.build(nodes);
  const result = verifyService.verify(nodes, indexes);
  return { nodes, indexes, result };
}

// 가상 빌드 — database/를 scan→정규화까지 돌려 git tree만 뜬다. .system·HEAD 불변, 원본 되쓰기 없음.
// diff의 'current'가 이걸 써 "빌드 전 사람 입력의 현재 상태"를 정규화 구조로 본다(ADR 0012).
function virtualBuild() {
  const cfg = load();
  const { nodes, indexes, result } = runChain(cfg.databaseDir);
  if (!result.ok) return { ok: false, errors: result.errors };
  const fileMap = indexService.normalize(nodes, indexes);
  const tree = snapshotService.treeFromFileMap(cfg.systemDbDir, fileMap);
  return { ok: true, tree };
}

function build() {
  const cfg = load();
  const dbDir = cfg.databaseDir; // 사람 입력(고정)
  const systemDb = cfg.systemDbDir; // 빌드 산출물(config로 조정 가능)

  // ── 조율 사슬 ──
  const { nodes, indexes, result } = runChain(dbDir);

  if (!result.ok) {
    // 검증 실패 — .system 갱신하지 않음(ADR 0008). 깨진 상태 안 남김.
    return { ok: false, errors: result.errors, nodeCount: nodes.length };
  }

  // 새로 발급된 id를 원본 .md에 되쓴다(ADR 0006 예외) — 재빌드 시 재사용해 id 안정.
  // Class는 폴더라 frontmatter가 없어 대상이 아니다(Concept/Instance만, 즉 .md 노드).
  const writtenBack = nodes.filter((n) => n.freshId && n.type !== 'Class');
  for (const node of writtenBack) writebackId(dbDir, node);

  // ── 통과 시 작업본 갱신 (history·backup은 안 건드림 — 그건 save의 일, ADR 0008) ──
  fs.mkdirSync(systemDb, { recursive: true });
  writeNormalized(systemDb, indexService.normalize(nodes, indexes));

  return {
    ok: true,
    nodeCount: nodes.length,
    edgeCount: indexes.graphIndex.edges.length,
    idsWritten: writtenBack.length,
  };
}

module.exports = { build, virtualBuild };
