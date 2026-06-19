'use strict';

// index-service (ADR 0006·0007). id 발급된 노드 목록을 받아 인덱스 3종을 만든다.
// - label→id 해소: 사람이 쓴 label 관계를 id로 변환(미해소는 표시해 verify가 잡음)
// - 역방향 edge 자동 생성(ADR 0006 규칙표)
// 단일 책임: 노드 목록 → 인덱스 3종. 검증·기록은 다른 단계가 한다.

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

module.exports = { build, REVERSE };
