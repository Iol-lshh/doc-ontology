'use strict';

// index-service (ADR 0006·0007). 인덱스 3종을 책임진다.
// 쓰기: id 발급된 노드 목록 → 인덱스 3종(label→id 해소 + 역방향 edge 자동 생성, ADR 0006 규칙표).
// 읽기: 기록된 인덱스 3종을 로드(find류 조회가 사용).
// 단일 책임: 인덱스 3종. 검증·기록 정책은 BuildFacade가 한다.

const fs = require('node:fs');
const path = require('node:path');

const REVERSE = {
  broader: 'narrower',
  narrower: 'broader',
  related: 'related',
  about: 'isAboutOf',
  class: 'hasInstance',
};

function build(nodes) {
  const labelIndex = {};
  const fileIndex = {};
  const byRelPath = {};
  for (const n of nodes) {
    labelIndex[n.label] = n.id;
    fileIndex[n.id] = n.relPath;
    byRelPath[n.relPath] = n;
  }

  const graphNodes = {};
  for (const n of nodes) graphNodes[n.id] = { type: n.type, label: n.label };

  const edges = [];
  const unresolved = []; // {from, rel, label} — verify가 잡는다

  const addEdge = (from, to, rel) => {
    edges.push({ from, to, rel });
    const rev = REVERSE[rel];
    if (rev) edges.push({ from: to, to: from, rel: rev });
  };

  for (const n of nodes) {
    // label 관계(broader/narrower/related/about) — label→id 해소
    for (const [rel, labels] of Object.entries(n.relations || {})) {
      for (const label of labels) {
        const toId = labelIndex[label];
        if (toId) addEdge(n.id, toId, rel);
        else unresolved.push({ from: n.id, rel, label });
      }
    }
    // class — Instance가 부모 폴더(Class)를 가리킴(위치로 결정, relPath로 해소)
    if (n.class) {
      const cls = byRelPath[n.class];
      if (cls) addEdge(n.id, cls.id, 'class');
      else unresolved.push({ from: n.id, rel: 'class', label: n.class });
    }
    // 폴더 상속 — Class가 상위 Class를 broader로 가리킴
    if (n.parentClass) {
      const parent = byRelPath[n.parentClass];
      if (parent) addEdge(n.id, parent.id, 'broader');
      else unresolved.push({ from: n.id, rel: 'broader', label: n.parentClass });
    }
  }

  const graphIndex = { nodes: graphNodes, edges };
  return { fileIndex, graphIndex, labelIndex, unresolved };
}

const TYPE_DIR = { Concept: 'concept', Class: 'class', Instance: 'instance' };

// 정규화 노드 1벌의 frontmatter — 빌드가 채운 id·type·label·관계 id(ADR 0008).
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

// 산출물을 경로→내용 맵으로 만든다(인덱스 3종 + 정규화 노드). 파일시스템·git과 무관한 순수 함수.
// BuildFacade는 이 맵을 .system에 쓰고, 가상 빌드는 tree로 뜬다(중복 제거, ADR 0013).
function normalize(nodes, indexes) {
  const out = {};
  const json = (o) => JSON.stringify(o, null, 2) + '\n';
  out['index/fileIndex.json'] = json(indexes.fileIndex);
  out['index/graphIndex.json'] = json(indexes.graphIndex);
  out['index/labelIndex.json'] = json(indexes.labelIndex);
  for (const node of nodes) {
    const body = node.body ? `\n${node.body}\n` : '';
    out[`${TYPE_DIR[node.type]}/${node.id}.md`] = normalizedFrontmatter(node, indexes) + body;
  }
  return out;
}

// 기록된 인덱스 3종을 읽는다. systemDbDir는 config가 resolve한 산출물 경로.
function read(systemDbDir) {
  const indexDir = path.join(systemDbDir, 'index');
  const readJson = (name) => {
    const file = path.join(indexDir, name);
    if (!fs.existsSync(file)) return null;
    const text = fs.readFileSync(file, 'utf8').trim();
    return text ? JSON.parse(text) : null;
  };
  return {
    fileIndex: readJson('fileIndex.json'),
    graphIndex: readJson('graphIndex.json'),
    labelIndex: readJson('labelIndex.json'),
  };
}

module.exports = { build, normalize, read, TYPE_DIR, REVERSE };
