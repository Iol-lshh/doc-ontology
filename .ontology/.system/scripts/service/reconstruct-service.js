'use strict';

// reconstruct-service. 정규화 시스템 DB(노드 by id + 인덱스 3종)를 유저 DB(database/ 원본 구조)로 역생성한다.
// 스냅샷은 시스템 DB만 담으므로(사용자 결정), 체크·초기화가 유저 DB를 과거/백업 구조로 되돌릴 때 이 서비스가 쓴다.
// byte 동일이 아니라 round-trip(다시 빌드하면 같은 그래프) 보존을 목표로 정규화한다:
//   - about    : 출발 노드에 기록(역방향 isAboutOf는 빌드가 재생성)
//   - broader  : 폴더 상속(위치) edge는 제외하고 기록 / narrower는 생략(broader로 복원됨)
//   - related  : 쌍당 한 번만(id 작은 쪽) 기록 — 빌드의 대칭 역방향 생성과 중복 방지
//   - class    : 생략(파일을 Class 폴더에 두는 것으로 위치가 결정)
// 비관계 frontmatter 키·원본 포맷은 보존하지 않는다(그래프에 영향 없음).

const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('./scan-service.js');
const indexService = require('./index-service.js');

const TYPE_DIR = { Concept: 'concept', Class: 'class', Instance: 'instance' };
const REL_KEYS = ['broader', 'related', 'about']; // 역생성 대상(narrower/class는 빌드/위치가 복원)

// 정규화 노드 파일에서 본문만 떼어낸다(frontmatter는 인덱스로 재구성하므로 버린다).
function bodyOf(systemDbDir, type, id) {
  const file = path.join(systemDbDir, TYPE_DIR[type], `${id}.md`);
  if (!fs.existsSync(file)) return '';
  return parseFrontmatter(fs.readFileSync(file, 'utf8')).body.trim();
}

// 노드 id의 '저자 작성' 관계를 graph에서 복원한다(역방향·위치 edge 제외).
function authoredRelations(id, node, graph, fileIndex) {
  const out = {}; // rel -> [labels]
  const labelOf = (to) => graph.nodes[to]?.label;
  const parentDir = path.dirname(fileIndex[id]); // 위치 broader 판별용(부모 폴더)
  for (const e of graph.edges) {
    if (e.from !== id) continue;
    if (e.rel === 'about') (out.about ||= []).push(labelOf(e.to));
    else if (e.rel === 'broader') {
      // Class가 부모 폴더를 가리키는 broader는 위치(폴더 상속)라 기록하지 않는다.
      const positional = node.type === 'Class' && fileIndex[e.to] === parentDir;
      if (!positional) (out.broader ||= []).push(labelOf(e.to));
    } else if (e.rel === 'related') {
      if (id < e.to) (out.related ||= []).push(labelOf(e.to)); // 쌍당 한 번
    }
    // narrower / class / isAboutOf / hasInstance: 생략(빌드 재생성 또는 위치가 결정)
  }
  return out;
}

function frontmatter(id, rels) {
  const lines = ['---', `id: ${id}`];
  for (const key of REL_KEYS) {
    if (rels[key]?.length) lines.push(`${key}: [${rels[key].map((l) => JSON.stringify(l)).join(', ')}]`);
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

// systemDbDir의 정규화 노드 + 인덱스를 읽어 databaseDir(유저 DB)를 통째로 다시 쓴다.
// 파괴적: databaseDir를 비우고 재생성한다(체크·초기화의 의도된 동작).
function reconstruct(systemDbDir, databaseDir) {
  const { fileIndex, graphIndex } = indexService.read(systemDbDir);
  if (!fileIndex || !graphIndex) return { ok: false, error: 'no index — 복원할 시스템 DB가 없습니다.' };

  fs.rmSync(databaseDir, { recursive: true, force: true });
  fs.mkdirSync(databaseDir, { recursive: true });

  for (const [id, relPath] of Object.entries(fileIndex)) {
    const node = graphIndex.nodes[id];
    if (!node) continue;
    if (node.type === 'Class') {
      // Class = 폴더. 빈 Class도 round-trip되도록 폴더만 만든다(파일 없음).
      fs.mkdirSync(path.join(databaseDir, relPath), { recursive: true });
      continue;
    }
    const file = path.join(databaseDir, relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const rels = authoredRelations(id, node, graphIndex, fileIndex);
    const body = bodyOf(systemDbDir, node.type, id);
    fs.writeFileSync(file, frontmatter(id, rels) + (body ? `\n${body}\n` : ''));
  }
  return { ok: true, count: Object.keys(fileIndex).length };
}

module.exports = { reconstruct };
